import importlib.util
import io
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location("release", Path(__file__).parents[2] / "scripts/apply-release-migration.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

class ReleaseTests(unittest.TestCase):
    def test_missing_token_sends_nothing(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(release, 'urlopen') as send:
            with self.assertRaises(SystemExit): release.main()
            send.assert_not_called()

    def test_only_incremental_migration_is_sent(self):
        def send(request, timeout):
            import json
            self.assertEqual(request.full_url, 'https://api.supabase.com/v1/projects/czkazbianiflhldenhcj/database/query')
            query = json.loads(request.data)['query']
            self.assertIn('ADD CONSTRAINT api_request_rate_limit_bucket_check', query)
            self.assertNotIn('CREATE TABLE', query)
            self.assertEqual(timeout, 60)
            return io.BytesIO(b'[]')
        with patch.dict(os.environ, {'SUPABASE_ACCESS_TOKEN':'test-only'}), patch.object(release,'urlopen',send), patch('sys.stdout',new_callable=io.StringIO):
            release.main()

    def test_failure_does_not_expose_response_or_token(self):
        error = HTTPError('https://api.supabase.com',401,'Unauthorized',{},io.BytesIO(b'secret-response'))
        with patch.dict(os.environ, {'SUPABASE_ACCESS_TOKEN':'test-only'}), patch.object(release,'urlopen',side_effect=error):
            with self.assertRaises(SystemExit) as caught: release.main()
            self.assertIn('401',str(caught.exception))
            self.assertNotIn('test-only',str(caught.exception))
            self.assertNotIn('secret-response',str(caught.exception))

if __name__ == '__main__': unittest.main()
