"""Route CI by event and an explicit documentation-only allowlist."""
import json
import os
from pathlib import Path, PurePosixPath
import subprocess


def git(*args):
    return subprocess.check_output(["git", *args])


def changed_paths(event_name, event):
    if event_name == "workflow_dispatch":
        return []
    if event_name == "pull_request":
        base = event["pull_request"]["base"]["sha"]
        head = event["pull_request"]["head"]["sha"]
    else:
        # Rebased-away tips need not exist in checkout's fetched history.
        # Empty/unknown scope conservatively selects the code lane below.
        if event.get("forced"):
            return []
        base, head = event["before"], event["after"]
        if base == "0" * 40:
            default = event["repository"]["default_branch"]
            base = git("merge-base", head, f"origin/{default}").decode().strip()
    # Count both sides of a rename: moving source into docs is still code work.
    return [p.decode("utf-8") for p in git(
        "diff", "--name-only", "--no-renames", "-z", base, head, "--"
    ).split(b"\0") if p]


def mode_for(event_name, event, paths):
    if event_name == "workflow_dispatch":
        return "full"
    docs_only = bool(paths) and all(
        PurePosixPath(p).suffix == ".md"
        and ("/" not in p or p.startswith("docs/"))
        for p in paths
    )
    if docs_only:
        return "docs"
    if event_name == "pull_request":
        return "core" if event["pull_request"]["draft"] else "full"
    default_ref = "refs/heads/" + event["repository"]["default_branch"]
    return "full" if event["ref"] == default_ref or event["ref"].startswith("refs/tags/") else "core"


def required_results(mode):
    if mode == "docs":
        return ["docs"]
    if mode == "core":
        return ["core"]
    if mode == "full":
        # Ready PR/main acceptance is conventional code verification, not UI journeys.
        return ["core"]
    raise ValueError("Unknown CI scope")


def verify_gate(needs, merge_gate=False):
    if needs["scope"]["result"] != "success":
        raise ValueError("CI scope did not succeed")
    mode = needs["scope"]["outputs"]["mode"]
    if merge_gate and mode == "core":
        raise ValueError("Core-only checks do not satisfy the merge gate")
    failures = [name for name in required_results(mode) if needs[name]["result"] != "success"]
    if failures:
        raise ValueError("Required lanes did not pass: " + ", ".join(failures))
    return mode


if __name__ == "__main__":
    if "CI_NEEDS" in os.environ:
        print("Verified CI scope:", verify_gate(json.loads(os.environ["CI_NEEDS"]), os.environ.get("CI_MERGE_GATE") == "true"))
    else:
        event_name = os.environ["GITHUB_EVENT_NAME"]
        event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
        paths = changed_paths(event_name, event)
        mode = mode_for(event_name, event, paths)
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            output.write(f"mode={mode}\n")
        print(f"CI scope: {mode}; changed paths: {len(paths)}")
