//! The Rust port of createOutlinerApi in server.mjs for one folder. Keep the checks, revisions and
//! error codes in sync with it: the page shows the codes through `server` in src/ui/messages.ts.
//! The app calls a Workspace under a lock, so unlike server.mjs no save can overlap another.

use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::{Component, Path, PathBuf};

use serde::Serialize;
use sha2::{Digest, Sha256};

const MAX_BYTES: u64 = 2 * 1024 * 1024;

/// An error code from `server` in src/ui/messages.ts, serialized as its name.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Code {
    NotMarkdown,
    FileMissing,
    OutsideWorkspace,
    FileTooLarge,
    InvalidContent,
    ExternalChange,
    ExternalChangeBeforeSave,
    SaveRace,
    FolderMissing,
    CreateOutsideFolder,
    FileExists,
    Internal,
}

#[derive(Debug)]
pub enum Error {
    /// A rejected request, shown to the user.
    Rejected(Code),
    /// A failure the page shows as `internal`; the app logs the details.
    Io(io::Error),
}

impl From<io::Error> for Error {
    fn from(error: io::Error) -> Self {
        Error::Io(error)
    }
}

impl From<Code> for Error {
    fn from(code: Code) -> Self {
        Error::Rejected(code)
    }
}

pub type Result<T> = std::result::Result<T, Error>;

/// The SHA-256 of the text as hex, the same value as `revisionOf` in server.mjs.
pub fn revision_of(text: &str) -> String {
    Sha256::digest(text.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

pub struct Workspace {
    root: PathBuf,
}

impl Workspace {
    pub fn open(folder: &Path) -> Result<Self> {
        let root = fs::canonicalize(folder)?;
        if !root.is_dir() {
            return Err(Code::FolderMissing.into());
        }
        Ok(Workspace { root })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn list(&self) -> Result<Vec<String>> {
        let mut files = Vec::new();
        files_in(&self.root, "", &mut files)?;
        // JavaScript's default sort compares UTF-16 code units, as server.mjs does.
        files.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
        Ok(files)
    }

    pub fn read(&self, relative: &str) -> Result<(String, String)> {
        let text = read_text(&self.markdown_file(relative)?)?;
        let revision = revision_of(&text);
        Ok((text, revision))
    }

    /// Writes `text` when the file still has the `expected` revision. The check detects existing
    /// external edits; uncoordinated writers can still race the final rename.
    pub fn save(&self, relative: &str, text: &str, expected: &str) -> Result<String> {
        check_size(text)?;
        let full = self.markdown_file(relative)?;
        if revision_of(&read_text(&full)?) != expected {
            return Err(Code::ExternalChange.into());
        }
        let mode = fs::metadata(&full)?.permissions().mode();
        let mut temporary = full.clone().into_os_string();
        temporary.push(format!(".outliner-{}", random_hex()?));
        let temporary = PathBuf::from(temporary);
        write_new(&temporary, text, mode)?;
        let result = (|| {
            if revision_of(&read_text(&full)?) != expected {
                return Err(Code::ExternalChangeBeforeSave.into());
            }
            fs::rename(&temporary, &full)?;
            if revision_of(&read_text(&full)?) != revision_of(text) {
                return Err(Code::SaveRace.into());
            }
            Ok(revision_of(text))
        })();
        if result.is_err() {
            // Gone after a successful rename; otherwise the attempt leaves nothing behind.
            let _ = fs::remove_file(&temporary);
        }
        result
    }

    pub fn create(&self, relative: &str, text: &str) -> Result<String> {
        check_size(text)?;
        check_relative(relative)?;
        // Lexical like path.resolve: `..` is removed before the folder is resolved.
        let full = normalize(&self.root.join(relative));
        let (Some(parent), Some(name)) = (full.parent(), full.file_name()) else {
            return Err(Code::CreateOutsideFolder.into());
        };
        let directory = fs::canonicalize(parent).map_err(|error| match error.kind() {
            io::ErrorKind::NotFound => Code::FolderMissing.into(),
            _ => Error::Io(error),
        })?;
        if !directory.starts_with(&self.root) {
            return Err(Code::CreateOutsideFolder.into());
        }
        // O_EXCL fails when anything (including a symbolic link) already exists at the path.
        write_new(&directory.join(name), text, 0o644).map_err(|error| match error {
            Error::Io(error) if error.kind() == io::ErrorKind::AlreadyExists => {
                Code::FileExists.into()
            }
            error => error,
        })?;
        Ok(revision_of(text))
    }

    fn markdown_file(&self, relative: &str) -> Result<PathBuf> {
        check_relative(relative)?;
        let full =
            fs::canonicalize(self.root.join(relative)).map_err(|error| match error.kind() {
                io::ErrorKind::NotFound => Code::FileMissing.into(),
                _ => Error::Io(error),
            })?;
        if full == self.root || !full.starts_with(&self.root) {
            return Err(Code::OutsideWorkspace.into());
        }
        let info = fs::metadata(&full)?;
        if !info.is_file() || info.len() > MAX_BYTES {
            return Err(Code::FileTooLarge.into());
        }
        Ok(full)
    }
}

fn check_relative(relative: &str) -> Result<()> {
    if !relative.ends_with(".md") || relative.contains('\\') || Path::new(relative).is_absolute() {
        return Err(Code::NotMarkdown.into());
    }
    Ok(())
}

fn check_size(text: &str) -> Result<()> {
    if text.len() as u64 > MAX_BYTES {
        return Err(Code::InvalidContent.into());
    }
    Ok(())
}

fn normalize(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::ParentDir => {
                normalized.pop();
            }
            Component::CurDir => {}
            other => normalized.push(other),
        }
    }
    normalized
}

fn files_in(directory: &Path, prefix: &str, files: &mut Vec<String>) -> Result<()> {
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        // Does not follow symbolic links, like the Dirent entries in server.mjs.
        let kind = entry.file_type()?;
        let relative = format!("{prefix}{name}");
        if kind.is_dir() {
            files_in(&entry.path(), &format!("{relative}/"), files)?;
        } else if kind.is_file() && name.ends_with(".md") {
            files.push(relative);
        }
    }
    Ok(())
}

/// Decodes like Node's readFile(path, 'utf8'), which replaces invalid sequences.
fn read_text(path: &Path) -> Result<String> {
    Ok(String::from_utf8_lossy(&fs::read(path)?).into_owned())
}

fn write_new(path: &Path, text: &str, mode: u32) -> Result<()> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(mode)
        .open(path)?;
    file.write_all(text.as_bytes())?;
    Ok(())
}

fn random_hex() -> Result<String> {
    let mut bytes = [0u8; 8];
    getrandom::fill(&mut bytes).map_err(|error| Error::Io(io::Error::other(error)))?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::symlink;

    struct Fixture {
        _base: tempfile::TempDir,
        folder: PathBuf,
        outside: PathBuf,
        workspace: Workspace,
    }

    fn fixture() -> Fixture {
        let base = tempfile::tempdir().unwrap();
        let folder = base.path().join("folder");
        let outside = base.path().join("outside");
        fs::create_dir_all(folder.join("sub")).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(folder.join("tasks.md"), "- [ ] a\n").unwrap();
        fs::write(folder.join("sub/b.md"), "- b\n").unwrap();
        fs::write(folder.join(".hidden.md"), "hidden\n").unwrap();
        fs::write(outside.join("secret.md"), "secret\n").unwrap();
        symlink(outside.join("secret.md"), folder.join("link.md")).unwrap();
        symlink(&outside, folder.join("linkdir")).unwrap();
        let workspace = Workspace::open(&folder).unwrap();
        Fixture {
            _base: base,
            folder,
            outside,
            workspace,
        }
    }

    fn code<T: std::fmt::Debug>(result: Result<T>) -> Code {
        match result {
            Err(Error::Rejected(code)) => code,
            other => panic!("expected a rejection, got {other:?}"),
        }
    }

    #[test]
    fn lists_markdown_files_skipping_hidden_files_and_symbolic_links() {
        let f = fixture();
        assert_eq!(f.workspace.list().unwrap(), ["sub/b.md", "tasks.md"]);
    }

    #[test]
    fn reads_a_file_with_the_revision_server_mjs_gives() {
        let f = fixture();
        let (text, revision) = f.workspace.read("tasks.md").unwrap();
        assert_eq!(text, "- [ ] a\n");
        assert_eq!(
            revision,
            "e4020b38aef8b24176ab50b1234944d669af801acfeb2e7209dd07c94a917404"
        );
    }

    #[test]
    fn rejects_paths_leading_outside() {
        let f = fixture();
        let absolute = f.outside.join("secret.md");
        assert_eq!(
            code(f.workspace.read("../outside/secret.md")),
            Code::OutsideWorkspace
        );
        assert_eq!(
            code(f.workspace.read(absolute.to_str().unwrap())),
            Code::NotMarkdown
        );
        assert_eq!(code(f.workspace.read("sub\\b.md")), Code::NotMarkdown);
        assert_eq!(code(f.workspace.read("tasks.txt")), Code::NotMarkdown);
        assert_eq!(code(f.workspace.read("link.md")), Code::OutsideWorkspace);
        assert_eq!(
            code(f.workspace.read("linkdir/secret.md")),
            Code::OutsideWorkspace
        );
        assert_eq!(code(f.workspace.read("missing.md")), Code::FileMissing);
        assert_eq!(
            code(
                f.workspace
                    .save("../outside/secret.md", "x", &revision_of("secret\n"))
            ),
            Code::OutsideWorkspace
        );
        assert_eq!(
            code(f.workspace.create("linkdir/new.md", "x")),
            Code::CreateOutsideFolder
        );
        assert_eq!(
            code(f.workspace.create("../outside/new.md", "x")),
            Code::CreateOutsideFolder
        );
        assert_eq!(
            fs::read_to_string(f.outside.join("secret.md")).unwrap(),
            "secret\n"
        );
        assert!(!f.outside.join("new.md").exists());
    }

    #[test]
    fn saves_when_the_revision_matches() {
        let f = fixture();
        let (_, revision) = f.workspace.read("tasks.md").unwrap();
        assert_eq!(
            f.workspace
                .save("tasks.md", "- [x] a\n", &revision)
                .unwrap(),
            revision_of("- [x] a\n")
        );
        assert_eq!(
            fs::read_to_string(f.folder.join("tasks.md")).unwrap(),
            "- [x] a\n"
        );
        assert_eq!(
            code(f.workspace.save("tasks.md", "- [ ] stale\n", &revision)),
            Code::ExternalChange
        );
        assert_eq!(
            fs::read_to_string(f.folder.join("tasks.md")).unwrap(),
            "- [x] a\n"
        );
        assert_eq!(
            f.workspace.list().unwrap(),
            ["sub/b.md", "tasks.md"],
            "no temporary file is left"
        );
    }

    #[test]
    fn rejects_content_over_the_size_limit() {
        let f = fixture();
        let (_, revision) = f.workspace.read("tasks.md").unwrap();
        let large = "x".repeat(MAX_BYTES as usize + 1);
        assert_eq!(
            code(f.workspace.save("tasks.md", &large, &revision)),
            Code::InvalidContent
        );
        assert_eq!(
            code(f.workspace.create("large.md", &large)),
            Code::InvalidContent
        );
    }

    #[test]
    fn creates_new_files_only() {
        let f = fixture();
        assert_eq!(
            f.workspace.create("sub/new.md", "- c\n").unwrap(),
            revision_of("- c\n")
        );
        assert_eq!(
            fs::read_to_string(f.folder.join("sub/new.md")).unwrap(),
            "- c\n"
        );
        assert_eq!(
            code(f.workspace.create("sub/new.md", "x")),
            Code::FileExists
        );
        assert_eq!(code(f.workspace.create("link.md", "x")), Code::FileExists);
        assert_eq!(
            code(f.workspace.create("none/new.md", "x")),
            Code::FolderMissing
        );
    }
}
