import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { truncate } from "../../utils/claude-shared";
import { listAllSessions, searchSessions, SessionSearchResult } from "../../utils/session-search";
import SessionDetail from "./detail";

const DEBOUNCE_MS = 300;
const ALL_PROJECTS = "all";
const PAGE_SIZE = 100;

export default function SearchSessions() {
  const [allSessions, setAllSessions] = useState<SessionSearchResult[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeepSearching, setIsDeepSearching] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedProject, setSelectedProject] = useState(ALL_PROJECTS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const projectNames = useMemo(() => {
    const names = new Set(allSessions.map((s) => s.projectName));
    return Array.from(names).sort();
  }, [allSessions]);

  useEffect(() => {
    const controller = new AbortController();
    listAllSessions(controller.signal)
      .then((sessions) => {
        if (!controller.signal.aborted) {
          setAllSessions(sessions);
          setFilteredSessions(sessions);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const applyFilters = useCallback((sessions: SessionSearchResult[], query: string, project: string) => {
    let result = sessions;
    if (project !== ALL_PROJECTS) {
      result = result.filter((s) => s.projectName === project);
    }
    if (query) {
      result = result.filter(
        (s) =>
          s.firstMessage.toLowerCase().includes(query) ||
          s.summary.toLowerCase().includes(query) ||
          s.projectName.toLowerCase().includes(query),
      );
    }
    return result;
  }, []);

  const handleSearch = useCallback(
    (text: string) => {
      setSearchText(text);
      setVisibleCount(PAGE_SIZE);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();

      const query = text.trim().toLowerCase();
      const localMatches = applyFilters(allSessions, query, selectedProject);
      setFilteredSessions(localMatches);

      if (query.length >= 3) {
        setIsDeepSearching(true);
        debounceRef.current = setTimeout(() => {
          const controller = new AbortController();
          abortRef.current = controller;
          const seenIds = new Set(localMatches.map((s) => s.id));

          searchSessions(
            text.trim(),
            (result) => {
              if (controller.signal.aborted) return;
              if (seenIds.has(result.id)) return;
              if (selectedProject !== ALL_PROJECTS && result.projectName !== selectedProject) return;
              seenIds.add(result.id);
              setFilteredSessions((prev) => [...prev, result]);
            },
            controller.signal,
          )
            .catch(() => {})
            .finally(() => {
              if (!controller.signal.aborted) {
                setIsDeepSearching(false);
              }
            });
        }, DEBOUNCE_MS);
      } else {
        setIsDeepSearching(false);
      }
    },
    [allSessions, selectedProject, applyFilters],
  );

  const handleProjectChange = useCallback(
    (project: string) => {
      if (abortRef.current) abortRef.current.abort();
      setIsDeepSearching(false);
      setSelectedProject(project);
      setVisibleCount(PAGE_SIZE);
      const query = searchText.trim().toLowerCase();
      const localMatches = applyFilters(allSessions, query, project);
      setFilteredSessions(localMatches);
    },
    [allSessions, searchText, applyFilters],
  );

  return (
    <List
      isLoading={isLoading || isDeepSearching}
      filtering={false}
      searchBarPlaceholder="Search all Claude Code sessions..."
      onSearchTextChange={handleSearch}
      pagination={{
        pageSize: PAGE_SIZE,
        hasMore: visibleCount < filteredSessions.length,
        onLoadMore: () => setVisibleCount((c) => c + PAGE_SIZE),
      }}
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by Project" value={selectedProject} onChange={handleProjectChange}>
          <List.Dropdown.Item title="All Projects" value={ALL_PROJECTS} />
          <List.Dropdown.Section title="Projects">
            {projectNames.map((name) => (
              <List.Dropdown.Item key={name} title={name} value={name} />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {filteredSessions.length === 0 && !isLoading && (
        <List.EmptyView
          title={isDeepSearching ? "Searching..." : searchText ? "No sessions found" : "No sessions"}
          description={
            isDeepSearching
              ? "Scanning session content..."
              : searchText
                ? `No sessions matching "${searchText}"`
                : "No Claude Code sessions found"
          }
        />
      )}
      {filteredSessions.slice(0, visibleCount).map((result) => (
        <List.Item
          key={result.id}
          title={truncate(result.firstMessage, 60)}
          accessories={[
            { tag: { value: result.projectName, color: Color.Blue } },
            { text: `~${result.turnCount} turns` },
            { date: result.lastModified },
          ]}
          actions={
            <ActionPanel>
              <Action.Push title="View Conversation" icon={Icon.Eye} target={<SessionDetail session={result} />} />
              <Action.CopyToClipboard
                title="Copy First Message"
                content={result.firstMessage}
                shortcut={{ modifiers: ["cmd"], key: "enter" }}
              />
              <Action.CopyToClipboard
                title="Copy Session ID"
                content={result.id}
                shortcut={{ modifiers: ["cmd"], key: "." }}
              />
              <Action.CopyToClipboard
                title="Copy Conversation File Path"
                icon={Icon.CopyClipboard}
                content={result.filePath}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              />
              <Action.CopyToClipboard
                title="Copy Project Path"
                icon={Icon.Folder}
                content={result.projectPath}
                shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
              />
              {result.projectPath.startsWith("/") && (
                <Action.ShowInFinder
                  path={result.projectPath}
                  title="Open Project in Finder"
                  icon={Icon.Folder}
                  shortcut={{ modifiers: ["cmd"], key: "o" }}
                />
              )}
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
