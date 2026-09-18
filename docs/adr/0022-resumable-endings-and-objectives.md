# ADR 0022: Resume exploration after a chapter ending

Status: accepted, 2026-09-18. Builds on ADRs 0011, 0017 and 0018.

An `end` story node may name an `explore` node in its optional `next` field.
The summary screen then offers **Continue exploring** alongside its save and
replay controls. Endings without `next` stay terminal. Entering the named node
uses the existing story reducer, including remembered arrival position, visited
nodes and the normal exploration screen. The authoring validator requires that
the link exists and targets an exploration node.

The active exploration node supplies the objective while the party is on that
node's map. During free roaming, the map supplies it instead. A map may list
ordered `objectiveVariants` guarded by the existing `Condition` predicates;
the first match wins and the plain map objective is the fallback. The banner and
journal use one resolver so they cannot disagree. Objective text is derived from
the existing story cursor, location and flags, with no new save field or
migration. This allows the Act 1 victory flag to guide the journey home across
the connected maps while leaving other outcome routes independent.
