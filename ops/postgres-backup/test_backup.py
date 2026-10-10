import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("backup", Path(__file__).with_name("backup.py"))
backup = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(backup)


class FakeS3:
    def __init__(self):
        self.objects = {}
        self.deleted = []
        self.corrupt_download = False
        self.fail_manifest = False

    def upload_file(self, path, bucket, key, ExtraArgs):
        self.objects[key] = (Path(path).read_bytes(), ExtraArgs.get("Metadata", {}))

    def head_object(self, Bucket, Key):
        data, metadata = self.objects[Key]
        return {"ContentLength": len(data), "Metadata": metadata}

    def get_object(self, Bucket, Key):
        data = self.objects[Key][0]
        if self.corrupt_download and Key.endswith(".age"):
            data += b"corruption"
        return {"Body": io.BytesIO(data)}

    def put_object(self, Bucket, Key, Body, ContentType):
        if self.fail_manifest:
            raise RuntimeError("upload failed")
        self.objects[Key] = (Body, {})

    def delete_object(self, Bucket, Key):
        self.deleted.append(Key)
        self.objects.pop(Key, None)

    def get_paginator(self, name):
        class Pages:
            def paginate(_self, Bucket, Prefix):
                yield {"Contents": [{"Key": key} for key in self.objects if key.startswith(Prefix)]}
        return Pages()


class BackupTests(unittest.TestCase):
    def publish(self, s3, run_id="20261010T034700Z-12345678"):
        with tempfile.TemporaryDirectory() as temp:
            encrypted = Path(temp) / "dump.age"
            encrypted.write_bytes(b"encrypted backup")
            return backup.publish_backup(s3, "test-bucket", "riftbound/production/", run_id, encrypted, {"restoreVerified": True})

    def test_commits_manifest_only_after_download_verification(self):
        s3 = FakeS3()
        manifest = self.publish(s3)
        key = manifest["objectKey"]
        self.assertTrue(key.endswith("/database.pgdump.age"))
        self.assertEqual(s3.objects[key][1]["sha256"], manifest["encryptedSha256"])
        self.assertEqual(json.loads(s3.objects[key.rsplit("/", 1)[0] + "/manifest.json"][0]), manifest)

    def test_corrupted_download_never_commits_or_rotates(self):
        s3 = FakeS3()
        s3.corrupt_download = True
        with self.assertRaisesRegex(RuntimeError, "checksum"):
            self.publish(s3)
        self.assertFalse(s3.objects)

    def test_failed_manifest_upload_cleans_only_its_own_attempt(self):
        s3 = FakeS3()
        s3.objects["riftbound/production/older/manifest.json"] = (b"older", {})
        s3.fail_manifest = True
        with self.assertRaisesRegex(RuntimeError, "upload failed"):
            self.publish(s3)
        self.assertEqual(list(s3.objects), ["riftbound/production/older/manifest.json"])

    def test_unique_runs_never_replace_a_same_day_backup(self):
        s3 = FakeS3()
        self.publish(s3, "20261010T034700Z-12345678")
        self.publish(s3, "20261010T034701Z-87654321")
        self.assertEqual(len(s3.objects), 4)

    def test_retention_keeps_seven_complete_copies_and_other_objects(self):
        s3 = FakeS3()
        for day in range(1, 10):
            run = f"202610{day:02d}T034700Z-12345678"
            self.publish(s3, run)
        s3.objects["riftbound/production/20261001T034700Z-00000000/database.pgdump.age"] = (b"incomplete", {})
        s3.objects["other-app/manifest.json"] = (b"other", {})
        s3.objects["riftbound/production/invalid/manifest.json"] = (b"invalid", {})
        backup.rotate_backups(s3, "test-bucket", "riftbound/production/", 7)
        self.assertEqual(sum(key.endswith("manifest.json") and "/2026" in key for key in s3.objects), 7)
        self.assertIn("other-app/manifest.json", s3.objects)
        self.assertIn("riftbound/production/invalid/manifest.json", s3.objects)
        self.assertIn("riftbound/production/20261001T034700Z-00000000/database.pgdump.age", s3.objects)
        self.assertEqual(len(s3.deleted), 4)

    def test_refuses_a_broad_prefix(self):
        for prefix in ["", "/", "riftbound/", "../production/", "riftbound/production"]:
            with self.subTest(prefix=prefix), self.assertRaises(ValueError):
                backup.validate_prefix(prefix)

    def test_table_comparison_ignores_order_and_detects_real_changes(self):
        original = {"public.user": 81, "public.collection_items": 1329}
        backup.verify_counts(original, {"public.collection_items": 1329, "public.user": 81})
        with self.assertRaisesRegex(RuntimeError, "table counts"):
            backup.verify_counts(original, {"public.user": 81, "public.collection_items": 1330})

    def test_sanitizes_credentials_in_database_errors(self):
        message = backup.safe_error(RuntimeError("failed postgresql://user:secret@host/db"))
        self.assertNotIn("secret", message)
        self.assertNotIn("user", message)


if __name__ == "__main__":
    unittest.main(verbosity=2)
