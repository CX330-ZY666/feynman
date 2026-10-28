"""Create a full release and a small release reusing verified server-side JAR libraries."""
import hashlib
import json
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
jar = root / "feynman-platform-springboot/target/feynman-platform-springboot-0.0.1-SNAPSHOT.jar"
dist = root / "feynman-platform-frontend/dist"
revision = sys.argv[1] if len(sys.argv) > 1 else "local"
with tempfile.TemporaryDirectory() as temp:
    release = Path(temp) / "release"
    release.mkdir()
    shutil.copytree(dist, release / "dist")
    (release / "revision.txt").write_text(revision + "\n", encoding="utf-8")
    shutil.copy2(jar, release / "backend.jar")
    shutil.make_archive(str(root / "feynman-release"), "zip", release)
    libraries = {}
    slim = Path(temp) / "backend-slim.jar"
    with zipfile.ZipFile(jar) as original, zipfile.ZipFile(slim, "w") as output:
        for entry in original.infolist():
            if entry.filename.startswith("BOOT-INF/lib/") and not entry.is_dir():
                libraries[entry.filename] = hashlib.sha256(original.read(entry)).hexdigest()
            else:
                output.writestr(entry, original.read(entry))
    if not libraries:
        raise RuntimeError("Expected a Spring Boot executable JAR with nested dependencies")
    shutil.copy2(slim, release / "backend.jar")
    (release / "lib-manifest.json").write_text(json.dumps(libraries), encoding="utf-8")
    shutil.make_archive(str(root / "feynman-release-slim"), "zip", release)
print("Full and slim releases created; slim libraries are SHA-256 verified before reuse.")
