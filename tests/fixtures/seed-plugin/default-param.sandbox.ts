// Regression fixture: a sandbox whose signature contains a brace (default
// object param). Body extraction must skip the parameter list and not mistake
// the `{` inside `= { showRaw: false }` for the function body's opening brace.
export default function sandbox(
  input: unknown,
  settings: { showRaw?: boolean } = { showRaw: false },
): unknown {
  void settings;
  return { marker: "extracted-body", got: input };
}
