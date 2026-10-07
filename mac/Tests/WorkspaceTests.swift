import Foundation

// Run with `npm run test:mac`. Plain assertions, because the Command Line Tools have no XCTest.

var failures = 0

func expect(_ condition: Bool, _ name: String) {
  if condition { print("ok - \(name)") } else { failures += 1; print("not ok - \(name)") }
}

func expectCode(_ code: String, _ name: String, _ body: () throws -> Void) {
  do { try body(); expect(false, name + " (no error)") }
  catch let error as WorkspaceError { expect(error.code == code, name + " (\(error.code))") }
  catch { expect(false, name + " (\(error))") }
}

@main
struct WorkspaceTests {
  static func main() throws {
    let manager = FileManager.default
    let base = manager.temporaryDirectory.appendingPathComponent("outliner-tests-" + UUID().uuidString).path
    defer { try? manager.removeItem(atPath: base) }
    let folder = base + "/folder"
    let outside = base + "/outside"
    try manager.createDirectory(atPath: folder + "/sub", withIntermediateDirectories: true)
    try manager.createDirectory(atPath: outside, withIntermediateDirectories: true)
    try "- [ ] a\n".write(toFile: folder + "/tasks.md", atomically: false, encoding: .utf8)
    try "- b\n".write(toFile: folder + "/sub/b.md", atomically: false, encoding: .utf8)
    try "secret\n".write(toFile: outside + "/secret.md", atomically: false, encoding: .utf8)
    try "hidden\n".write(toFile: folder + "/.hidden.md", atomically: false, encoding: .utf8)
    try manager.createSymbolicLink(atPath: folder + "/link.md", withDestinationPath: outside + "/secret.md")
    try manager.createSymbolicLink(atPath: folder + "/linkdir", withDestinationPath: outside)
    let workspace = try Workspace(folder: folder)

    expect(try workspace.list() == ["sub/b.md", "tasks.md"], "lists Markdown files, skipping hidden files and symbolic links")

    let read = try workspace.read("tasks.md")
    expect(read.text == "- [ ] a\n", "reads a file")
    // The value revisionOf in server.mjs gives for the same text.
    expect(read.revision == "e4020b38aef8b24176ab50b1234944d669af801acfeb2e7209dd07c94a917404", "revision matches server.mjs")

    expectCode("outsideWorkspace", "rejects ..") { _ = try workspace.read("../outside/secret.md") }
    expectCode("notMarkdown", "rejects an absolute path") { _ = try workspace.read(outside + "/secret.md") }
    expectCode("notMarkdown", "rejects a backslash") { _ = try workspace.read("sub\\b.md") }
    expectCode("notMarkdown", "rejects a non-Markdown file") { _ = try workspace.read("tasks.txt") }
    expectCode("outsideWorkspace", "rejects a symbolic link to a file outside") { _ = try workspace.read("link.md") }
    expectCode("outsideWorkspace", "rejects a path through a symbolic link to a folder outside") { _ = try workspace.read("linkdir/secret.md") }
    expectCode("fileMissing", "reports a missing file") { _ = try workspace.read("missing.md") }
    expectCode("outsideWorkspace", "rejects saving outside") {
      _ = try workspace.save("../outside/secret.md", text: "x", revision: revisionOf("secret\n"))
    }
    expectCode("createOutsideFolder", "rejects creating through a symbolic link to a folder outside") {
      _ = try workspace.create("linkdir/new.md", text: "x")
    }
    expectCode("createOutsideFolder", "rejects creating with ..") { _ = try workspace.create("../outside/new.md", text: "x") }
    expect(try String(contentsOfFile: outside + "/secret.md", encoding: .utf8) == "secret\n", "the file outside is unchanged")
    expect(!manager.fileExists(atPath: outside + "/new.md"), "nothing was created outside")

    let saved = try workspace.save("tasks.md", text: "- [x] a\n", revision: read.revision)
    expect(saved == revisionOf("- [x] a\n"), "save returns the revision of the saved text")
    expect(try String(contentsOfFile: folder + "/tasks.md", encoding: .utf8) == "- [x] a\n", "save writes the file")
    expectCode("externalChange", "rejects a save with a stale revision") {
      _ = try workspace.save("tasks.md", text: "- [ ] stale\n", revision: read.revision)
    }
    expect(try workspace.list() == ["sub/b.md", "tasks.md"], "save leaves no temporary file")

    expect(try workspace.create("sub/new.md", text: "- c\n") == revisionOf("- c\n"), "creates a file in a subfolder")
    expectCode("fileExists", "rejects creating an existing file") { _ = try workspace.create("sub/new.md", text: "x") }
    expectCode("fileExists", "rejects creating over a symbolic link") { _ = try workspace.create("link.md", text: "x") }
    expectCode("folderMissing", "reports a missing folder") { _ = try workspace.create("none/new.md", text: "x") }

    if failures > 0 { print("\(failures) failed"); exit(1) }
  }
}
