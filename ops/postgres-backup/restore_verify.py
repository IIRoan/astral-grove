#!/usr/bin/env python3
"""Download and decrypt an archive, then prove recovery in a fresh local database."""
import argparse
import json
import os
from pathlib import Path
import tempfile

from backup import download_object, list_backups, log, run, s3_client, safe_error, sha256, validate_prefix, verify_restore


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--key-file", required=True)
    parser.add_argument("--backup-id")
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    client = s3_client()
    bucket = os.environ["S3_BUCKET"]
    prefix = validate_prefix(os.environ.get("S3_PREFIX", "riftbound/production/"))
    backups = list_backups(client, bucket, prefix)
    if not backups:
        raise RuntimeError("No complete backups found")
    backup_id = args.backup_id or backups[-1]
    if backup_id not in backups:
        raise ValueError("Requested backup is not a complete archive")
    body = client.get_object(Bucket=bucket, Key=f"{prefix}{backup_id}/manifest.json")["Body"]
    try:
        manifest = json.loads(body.read())
    finally:
        body.close()
    expected_key = f"{prefix}{backup_id}/database.pgdump.age"
    if manifest.get("objectKey") != expected_key or manifest.get("restoreVerified") is not True or manifest.get("uploadVerified") is not True:
        raise RuntimeError("Backup manifest is invalid")
    with tempfile.TemporaryDirectory(prefix="recovery-", dir="/work") as temp:
        work = Path(temp)
        encrypted = work / "database.pgdump.age"
        dump = work / "database.pgdump"
        download_object(client, bucket, expected_key, encrypted)
        if sha256(encrypted) != manifest["encryptedSha256"]:
            raise RuntimeError("Downloaded encrypted checksum mismatch")
        run(["age", "-d", "-i", args.key_file, "-o", str(dump), str(encrypted)])
        if sha256(dump) != manifest["dumpSha256"]:
            raise RuntimeError("Decrypted dump checksum mismatch")
        counts = verify_restore(dump, manifest["tableCounts"], work)
    report = {"backupId": backup_id, "encryptedChecksumVerified": True, "decryptionVerified": True, "dumpChecksumVerified": True, "allTableCountsVerified": True, "tableCounts": counts}
    Path(args.report).write_text(json.dumps(report, indent=2) + "\n")
    log(f"Recovery verified for {backup_id}: {len(counts)} tables match")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        log("FATAL: " + safe_error(error))
        raise SystemExit(1)
