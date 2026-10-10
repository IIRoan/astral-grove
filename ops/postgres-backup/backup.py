#!/usr/bin/env python3
"""Read a consistent Postgres snapshot, prove it restores, then archive it in S3."""
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import select
import subprocess
import tempfile
import uuid


def log(message):
    print(f"[{datetime.now(timezone.utc).isoformat()}] {message}", flush=True)


def safe_error(error):
    return re.sub(r"postgres(?:ql)?://[^\s]+", "<redacted database URL>", str(error))


def run(args, env=None, timeout=300):
    result = subprocess.run(args, env=env, text=True, capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(f"{Path(args[0]).name} failed: {safe_error(result.stderr)}")
    return result.stdout


def sha256(path):
    with open(path, "rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def validate_prefix(prefix):
    if not re.fullmatch(r"[a-z0-9_-]+/[a-z0-9_-]+/", prefix):
        raise ValueError("Backup prefix must name a dedicated app/environment directory")
    return prefix


def s3_client():
    import boto3
    from botocore.config import Config
    required = ["S3_ENDPOINT", "S3_BUCKET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]
    for key in required:
        if not os.environ.get(key):
            raise ValueError(f"Missing {key}")
    if not os.environ["S3_ENDPOINT"].startswith("https://"):
        raise ValueError("S3 endpoint must use HTTPS")
    return boto3.client(
        "s3",
        endpoint_url=os.environ["S3_ENDPOINT"],
        region_name=os.environ.get("AWS_DEFAULT_REGION", "auto"),
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": os.environ.get("S3_ADDRESSING_STYLE", "virtual")},
            retries={"max_attempts": 4, "mode": "standard"},
            connect_timeout=30,
            read_timeout=120,
        ),
    )


def download_object(s3, bucket, key, path):
    response = s3.get_object(Bucket=bucket, Key=key)
    body = response["Body"]
    try:
        with open(path, "wb") as output:
            while chunk := body.read(1024 * 1024):
                output.write(chunk)
    finally:
        body.close()


def publish_backup(s3, bucket, prefix, run_id, encrypted, manifest):
    validate_prefix(prefix)
    if not re.fullmatch(r"[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}", run_id):
        raise ValueError("Invalid backup ID")
    if manifest.get("restoreVerified") is not True:
        raise ValueError("Only restored and verified dumps can be published")
    object_key = f"{prefix}{run_id}/database.pgdump.age"
    manifest_key = f"{prefix}{run_id}/manifest.json"
    digest = sha256(encrypted)
    size = encrypted.stat().st_size
    committed = {**manifest, "objectKey": object_key, "encryptedSha256": digest, "encryptedBytes": size, "uploadVerified": True}
    try:
        s3.upload_file(str(encrypted), bucket, object_key, ExtraArgs={"ContentType": "application/octet-stream", "Metadata": {"sha256": digest}})
        if s3.head_object(Bucket=bucket, Key=object_key)["ContentLength"] != size:
            raise RuntimeError("Uploaded backup size mismatch")
        downloaded = encrypted.with_suffix(".download-verification")
        try:
            download_object(s3, bucket, object_key, downloaded)
            if sha256(downloaded) != digest:
                raise RuntimeError("Uploaded backup checksum mismatch")
        finally:
            downloaded.unlink(missing_ok=True)
        encoded = json.dumps(committed, sort_keys=True).encode()
        s3.put_object(Bucket=bucket, Key=manifest_key, Body=encoded, ContentType="application/json")
        body = s3.get_object(Bucket=bucket, Key=manifest_key)["Body"]
        try:
            if body.read() != encoded:
                raise RuntimeError("Uploaded manifest mismatch")
        finally:
            body.close()
    except Exception:
        for key in (manifest_key, object_key):
            try:
                s3.delete_object(Bucket=bucket, Key=key)
            except Exception:
                pass
        raise
    return committed


def list_backups(s3, bucket, prefix):
    validate_prefix(prefix)
    pattern = re.compile(re.escape(prefix) + r"([0-9]{8}T[0-9]{6}Z-[0-9a-f]{8})/manifest\.json$")
    result = []
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        for item in page.get("Contents", []):
            match = pattern.fullmatch(item["Key"])
            if match:
                result.append(match.group(1))
    return sorted(result)


def rotate_backups(s3, bucket, prefix, keep=7):
    if keep < 1:
        raise ValueError("At least one backup must be retained")
    backups = list_backups(s3, bucket, prefix)
    for run_id in backups[:-keep]:
        log(f"Retiring verified archive {run_id}")
        # Remove the commit marker first so incomplete deletion cannot look recoverable.
        for filename in ("manifest.json", "database.pgdump.age"):
            s3.delete_object(Bucket=bucket, Key=f"{prefix}{run_id}/{filename}")
    return min(len(backups), keep)


@contextmanager
def exported_snapshot(source_url):
    env = {**os.environ, "PGOPTIONS": "-c default_transaction_read_only=on"}
    with tempfile.TemporaryFile(mode="w+") as errors:
        process = subprocess.Popen(["psql", "-XqAt", "-v", "ON_ERROR_STOP=1", "-d", source_url], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errors, text=True, env=env)
        try:
            process.stdin.write("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSELECT pg_export_snapshot();\n")
            process.stdin.flush()
            if not select.select([process.stdout], [], [], 40)[0]:
                raise RuntimeError("Source snapshot timed out")
            snapshot = process.stdout.readline().strip()
            if not re.fullmatch(r"[0-9a-fA-F]+-[0-9a-fA-F]+-[0-9]+", snapshot):
                errors.seek(0)
                raise RuntimeError("Cannot export source snapshot: " + safe_error(errors.read()))
            yield snapshot, env
        finally:
            if process.poll() is None:
                try:
                    process.stdin.write("ROLLBACK;\n\\q\n")
                    process.stdin.flush()
                    process.wait(timeout=10)
                except (BrokenPipeError, subprocess.TimeoutExpired):
                    process.kill()
                    process.wait()
            process.stdin.close()
            process.stdout.close()


def sql_query(connection_args, query, snapshot=None, env=None):
    if snapshot:
        if not re.fullmatch(r"[0-9a-fA-F]+-[0-9a-fA-F]+-[0-9]+", snapshot):
            raise ValueError("Invalid snapshot ID")
        query = f"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET TRANSACTION SNAPSHOT '{snapshot}'; {query}; ROLLBACK;"
    return run(["psql", "-XqAt", "-v", "ON_ERROR_STOP=1", *connection_args, "-c", query], env=env)


def table_counts(connection_args, snapshot=None, env=None):
    tables = sql_query(connection_args, "SELECT json_build_object('schema',schemaname,'table',tablename) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY schemaname,tablename", snapshot, env)
    selects = []
    for line in tables.splitlines():
        table = json.loads(line)
        schema, name = table["schema"], table["table"]
        identifier = '.'.join('"' + value.replace('"', '""') + '"' for value in (schema, name))
        label = (schema + "." + name).replace("'", "''")
        selects.append(f"SELECT json_build_object('table','{label}','count',count(*)) FROM {identifier}")
    if not selects:
        raise RuntimeError("No application tables found")
    rows = sql_query(connection_args, " UNION ALL ".join(selects), snapshot, env)
    return {row["table"]: row["count"] for row in map(json.loads, rows.splitlines())}


def verify_counts(expected, actual):
    if expected != actual:
        changed = sorted(key for key in expected.keys() | actual.keys() if expected.get(key) != actual.get(key))
        raise RuntimeError("Restored table counts differ: " + ", ".join(changed))


def verify_restore(dump, expected, work):
    data = work / "validation-postgres"
    sockets = work / "sockets"
    sockets.mkdir(mode=0o700)
    run(["initdb", "-D", str(data), "-U", "postgres", "-A", "trust", "--no-locale", "--encoding=UTF8"])
    options = f"-k {sockets} -p 5544 -c listen_addresses='' -c shared_buffers=32MB -c max_connections=10"
    run(["pg_ctl", "-D", str(data), "-l", str(work / "validation-postgres.log"), "-o", options, "-w", "start"])
    connection = ["-h", str(sockets), "-p", "5544", "-U", "postgres", "-d", "postgres"]
    try:
        run(["pg_restore", "--no-owner", "--no-privileges", "--exit-on-error", *connection, str(dump)])
        actual = table_counts(connection)
        verify_counts(expected, actual)
        return actual
    finally:
        run(["pg_ctl", "-D", str(data), "-m", "fast", "-w", "stop"], timeout=60)


def main():
    source = os.environ["VPS_DB_URL"]
    recipient = os.environ["AGE_RECIPIENT"]
    if not recipient.startswith("age1"):
        raise ValueError("An age public recipient is required")
    prefix = validate_prefix(os.environ.get("S3_PREFIX", "riftbound/production/"))
    bucket = os.environ["S3_BUCKET"]
    client = s3_client()
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ-") + uuid.uuid4().hex[:8]
    log(f"Creating archive {run_id}")
    with tempfile.TemporaryDirectory(prefix="backup-", dir="/work") as temp:
        work = Path(temp)
        dump = work / "database.pgdump"
        with exported_snapshot(source) as (snapshot, env):
            expected = table_counts(["-d", source], snapshot, env)
            run(["pg_dump", "-Fc", "--no-owner", "--no-privileges", "--snapshot", snapshot, "-d", source, "-f", str(dump)], env=env)
        if dump.stat().st_size < 1_000_000:
            raise RuntimeError("Dump is suspiciously small (<1 MB)")
        run(["pg_restore", "-l", str(dump)])
        log(f"Dump created: {dump.stat().st_size} bytes; validating {len(expected)} tables")
        verify_restore(dump, expected, work)
        log("Isolated restore verified against the same source snapshot")
        encrypted = work / "database.pgdump.age"
        run(["age", "-r", recipient, "-o", str(encrypted), str(dump)])
        manifest = {
            "formatVersion": 1,
            "backupId": run_id,
            "createdAtUtc": datetime.now(timezone.utc).isoformat(),
            "postgresVersion": run(["pg_dump", "--version"]).strip(),
            "dumpBytes": dump.stat().st_size,
            "dumpSha256": sha256(dump),
            "tableCounts": expected,
            "encryption": "age",
            "recipient": recipient,
            "restoreVerified": True,
        }
        published = publish_backup(client, bucket, prefix, run_id, encrypted, manifest)
        log(f"Encrypted archive uploaded and download checksum verified: {published['objectKey']}")
        retained = rotate_backups(client, bucket, prefix, int(os.environ.get("BACKUP_KEEP", "7")))
        log(f"Backup complete; {retained} verified archives retained (limit {os.environ.get('BACKUP_KEEP', '7')})")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        log("FATAL: " + safe_error(error))
        raise SystemExit(1)
