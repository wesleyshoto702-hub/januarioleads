"""Offline checks for Overture rollout planning; never contacts live providers."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "plan_overture_expansion.py"
spec = importlib.util.spec_from_file_location("plan_overture_expansion", SCRIPT)
planner = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(planner)


class ExpansionSafetyTests(unittest.TestCase):
    def test_all_27_states_have_candidate_city(self):
        self.assertEqual(len(planner.STATE_CODES), 27)
        self.assertTrue(all(planner.CITY_WAVES[state] for state in planner.STATE_CODES))

    def test_initial_wave_is_small_and_dry_run_only(self):
        commands = planner.plan(["MG"], 30, 100)
        self.assertEqual(len(commands), 4)
        self.assertTrue(all(" --dry-run" in cmd for _, _, cmd in commands))
        self.assertTrue(all("service_role" not in cmd for _, _, cmd in commands))
        self.assertTrue(all(" --database-max-mb 100" in cmd for _, _, cmd in commands))

    def test_no_large_or_invalid_unbounded_batch(self):
        for size in (0, 101, -1):
            with self.assertRaises(ValueError):
                planner.plan(["MG"], size, 100)
        with self.assertRaises(ValueError):
            planner.plan(["MG", "MG"])
        with self.assertRaises(ValueError):
            planner.plan(["XX"])
        with self.assertRaises(ValueError):
            planner.plan(["MG"], 30, 481)

    def test_city_commands_do_not_union_distant_city_bboxes(self):
        commands = planner.plan(["MG", "SP"], 30, 100)
        self.assertEqual(len(commands), 6)
        self.assertTrue(all(cmd.count("--cities ") == 1 for _, _, cmd in commands))


if __name__ == "__main__":
    unittest.main()
