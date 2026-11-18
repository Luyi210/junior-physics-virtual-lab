import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock


SCRIPT = Path(__file__).with_name("initialize-private-config.py")
SPEC = importlib.util.spec_from_file_location("physics_private_config", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class PrivateInitializationTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        directory = Path(self.temporary.name)
        self.env_file = directory / "physics-lab.env"
        self.database_file = directory / "physics-lab.sqlite"
        self.env_file.write_text(
            "PHYSICS_BOOTSTRAP_ADMIN_EMAIL=admin@example.invalid\n"
            "PHYSICS_BOOTSTRAP_SCHOOL_NAME=\n"
            "PHYSICS_BOOTSTRAP_ADMIN_NAME=\n"
            "PHYSICS_BOOTSTRAP_ADMIN_PASSWORD=\n"
            "PHYSICS_API_TOKEN_SECRET=__REPLACE_WITH_PRIVATE_RANDOM_64_HEX__\n",
            encoding="utf-8",
        )
        os.chmod(self.env_file, 0o600)

    def initialize(self, passwords=("Synthetic_Password.2026", "Synthetic_Password.2026")):
        with mock.patch.object(MODULE, "require_controlled_tty"), mock.patch(
            "getpass.getpass", side_effect=passwords
        ):
            MODULE.initialize(
                self.env_file, self.database_file, require_root=False, check_service=False
            )

    def test_initializes_once_without_printing_credentials(self):
        self.initialize()
        content = self.env_file.read_text(encoding="utf-8")
        self.assertIn("PHYSICS_BOOTSTRAP_ADMIN_EMAIL=admin@example.invalid\n", content)
        self.assertIn("PHYSICS_BOOTSTRAP_SCHOOL_NAME=格物实验室\n", content)
        self.assertIn("PHYSICS_BOOTSTRAP_ADMIN_NAME=平台管理员\n", content)
        self.assertIn("PHYSICS_BOOTSTRAP_ADMIN_PASSWORD=Synthetic_Password.2026\n", content)
        self.assertRegex(content, r"PHYSICS_API_TOKEN_SECRET=[a-f0-9]{64}\n")
        self.assertEqual(self.env_file.stat().st_mode & 0o777, 0o600)
        with self.assertRaises(ValueError):
            self.initialize()

    def test_rejects_mismatched_password_without_file_change(self):
        before = self.env_file.read_bytes()
        with self.assertRaises(ValueError):
            self.initialize(("Synthetic_Password.2026", "Different_Password.2026"))
        self.assertEqual(self.env_file.read_bytes(), before)

    def test_rejects_existing_database_before_prompt(self):
        self.database_file.touch()
        with self.assertRaises(ValueError):
            self.initialize(())


if __name__ == "__main__":
    unittest.main()
