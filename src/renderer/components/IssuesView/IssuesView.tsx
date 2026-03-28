// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, useCallback, useRef} from 'react';

import './IssuesView.scss';

// ── Types ──────────────────────────────────────────────────────────────────

type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
type IssuePriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';
type GroupBy = 'status' | 'priority' | 'cycle' | 'none';
type SubTab = 'agents' | 'diff' | 'docs';

interface Project { id: string; name: string; prefix: string; next_issue_number: number }
interface Issue {
    id: string; project_id: string; identifier: string; title: string; description: string;
    status: IssueStatus; priority: IssuePriority; label_ids: string[]; assignee_id: string;
    cycle_id: string; estimate_hours: number; sort_order: number;
}
interface IssueLabel { id: string; name: string; color: string }
interface Cycle { id: string; name: string; is_active: boolean }
interface IssueFilters { status?: IssueStatus; priority?: IssuePriority; cycleId?: string; searchQuery?: string; groupBy: GroupBy }

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<IssueStatus, string> = {
    backlog: 'Backlog', todo: 'Todo', in_progress: 'In Progress',
    in_review: 'In Review', done: 'Done', cancelled: 'Cancelled',
};
const STATUS_COLORS: Record<IssueStatus, string> = {
    backlog: '#8b95a1', todo: '#3d9ef5', in_progress: '#f5a623',
    in_review: '#9b59b6', done: '#3dc779', cancelled: '#e05c5c',
};
const PRIORITY_LABELS: Record<IssuePriority, string> = {
    urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low', none: 'No Priority',
};
const PRIORITY_COLORS: Record<IssuePriority, string> = {
    urgent: '#e05c5c', high: '#f5a623', medium: '#f5d63d', low: '#3d9ef5', none: '#8b95a1',
};
const PRIORITY_ICONS: Record<IssuePriority, string> = {
    urgent: '!', high: '↑', medium: '—', low: '↓', none: '·',
};
const STATUS_ORDER: IssueStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'];
const PRIORITY_ORDER: IssuePriority[] = ['urgent', 'high', 'medium', 'low', 'none'];

// ── API helper ─────────────────────────────────────────────────────────────

function api<T>(method: string, path: string, body?: unknown): Promise<T> {
    return window.desktop.issuesApiRequest(method, path, body) as Promise<T>;
}

// ── Sidebar sub-components ─────────────────────────────────────────────────

const PriorityIcon: React.FC<{priority: IssuePriority}> = ({priority}) => (
    <span
        className='IV__priorityIcon'
        title={PRIORITY_LABELS[priority]}
        style={{color: PRIORITY_COLORS[priority]}}
    >
        {PRIORITY_ICONS[priority]}
    </span>
);

const StatusDot: React.FC<{status: IssueStatus}> = ({status}) => (
    <span
        className='IV__statusDot'
        style={{background: STATUS_COLORS[status], boxShadow: `0 0 0 1px ${STATUS_COLORS[status]}60`}}
        title={STATUS_LABELS[status]}
    />
);

const LabelPill: React.FC<{label: IssueLabel}> = ({label}) => (
    <span
        className='IV__labelPill'
        style={{background: label.color + '28', color: label.color, border: `1px solid ${label.color}55`}}
    >
        {label.name}
    </span>
);

// ── ProjectSelector ────────────────────────────────────────────────────────

const ProjectSelector: React.FC<{
    projects: Project[];
    activeProjectId: string;
    onSelect: (id: string) => void;
    onCreate: (data: {name: string; prefix: string}) => void;
}> = ({projects, activeProjectId, onSelect, onCreate}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPrefix, setNewPrefix] = useState('');

    const handleCreate = () => {
        if (newName.trim() && newPrefix.trim()) {
            onCreate({name: newName.trim(), prefix: newPrefix.trim()});
            setNewName(''); setNewPrefix(''); setIsCreating(false);
        }
    };

    if (isCreating) {
        return (
            <div className='IV__createProject'>
                <input autoFocus={true} type='text' placeholder='Name' value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { handleCreate(); } else if (e.key === 'Escape') { setIsCreating(false); } }}
                    className='IV__input IV__input--sm'/>
                <input type='text' placeholder='PRE' value={newPrefix}
                    onChange={(e) => setNewPrefix(e.target.value.toUpperCase())}
                    className='IV__input IV__input--sm IV__input--prefix'/>
                <button onClick={handleCreate} className='IV__btn IV__btn--xs'>{'OK'}</button>
                <button onClick={() => setIsCreating(false)} className='IV__btn IV__btn--xs IV__btn--ghost'>{'✕'}</button>
            </div>
        );
    }

    return (
        <div className='IV__projectSelector'>
            <select value={activeProjectId} onChange={(e) => onSelect(e.target.value)} className='IV__projectSelect'>
                {projects.length === 0 && <option value=''>{'No projects'}</option>}
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={() => setIsCreating(true)} title='New project' className='IV__iconBtn'>{'+' }</button>
        </div>
    );
};

// ── IssueRow ───────────────────────────────────────────────────────────────

const IssueRow: React.FC<{
    issue: Issue;
    labels: Record<string, IssueLabel>;
    isActive: boolean;
    onClick: () => void;
}> = ({issue, labels, isActive, onClick}) => {
    const issueLabels = (issue.label_ids || []).map((id) => labels[id]).filter(Boolean);
    return (
        <div onClick={onClick} className={`IV__issueRow${isActive ? ' IV__issueRow--active' : ''}`}>
            <PriorityIcon priority={issue.priority}/>
            <StatusDot status={issue.status}/>
            <span className='IV__issueId'>{issue.identifier}</span>
            <span className='IV__issueTitle'>{issue.title}</span>
            {issueLabels.length > 0 && (
                <div className='IV__issueLabelRow'>
                    {issueLabels.map((label) => <LabelPill key={label.id} label={label}/>)}
                </div>
            )}
        </div>
    );
};

// ── IssueList ──────────────────────────────────────────────────────────────

const IssueList: React.FC<{
    groupedIssues: Record<string, Issue[]>;
    labels: Record<string, IssueLabel>;
    filters: IssueFilters;
    activeIssueId: string | null;
    onClickIssue: (issue: Issue) => void;
}> = ({groupedIssues, labels, filters, activeIssueId, onClickIssue}) => {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const entries = Object.entries(groupedIssues);
    const groupBy = filters.groupBy || 'status';

    if (entries.length === 0) {
        return <div className='IV__empty'>{'No issues found'}</div>;
    }

    const getLabel = (key: string) => {
        if (groupBy === 'status') { return STATUS_LABELS[key as IssueStatus] || key; }
        if (groupBy === 'priority') { return PRIORITY_LABELS[key as IssuePriority] || key; }
        return key === 'no_cycle' ? 'No Cycle' : key;
    };
    const getColor = (key: string) => {
        if (groupBy === 'status') { return STATUS_COLORS[key as IssueStatus] || '#8b95a1'; }
        if (groupBy === 'priority') { return PRIORITY_COLORS[key as IssuePriority] || '#8b95a1'; }
        return '#8b95a1';
    };

    return (
        <div className='IV__list'>
            {entries.map(([key, issues]) => {
                if (groupBy !== 'none' && issues.length === 0) { return null; }
                const isCollapsed = collapsed[key];
                const color = getColor(key);
                return (
                    <div key={key}>
                        {groupBy !== 'none' && (
                            <div className='IV__groupHeader' onClick={() => setCollapsed({...collapsed, [key]: !isCollapsed})}>
                                <span className='IV__groupCaret'>{isCollapsed ? '▸' : '▾'}</span>
                                <span className='IV__groupDot' style={{background: color}}/>
                                <span className='IV__groupLabel' style={{color}}>{getLabel(key)}</span>
                                <span className='IV__groupCount'>({issues.length})</span>
                            </div>
                        )}
                        {!isCollapsed && issues.map((issue) => (
                            <IssueRow
                                key={issue.id}
                                issue={issue}
                                labels={labels}
                                isActive={activeIssueId === issue.id}
                                onClick={() => onClickIssue(issue)}
                            />
                        ))}
                    </div>
                );
            })}
        </div>
    );
};

// ── CreateIssueModal ───────────────────────────────────────────────────────

const CreateIssueModal: React.FC<{
    issue?: Issue | null;
    labels: IssueLabel[];
    cycles: Cycle[];
    onSave: (data: Partial<Issue>) => void;
    onDelete?: () => void;
    onClose: () => void;
}> = ({issue, labels, cycles, onSave, onDelete, onClose}) => {
    const [title, setTitle] = useState(issue?.title ?? '');
    const [description, setDescription] = useState(issue?.description ?? '');
    const [status, setStatus] = useState<IssueStatus>(issue?.status ?? 'backlog');
    const [priority, setPriority] = useState<IssuePriority>(issue?.priority ?? 'none');
    const [labelIds, setLabelIds] = useState<string[]>(issue?.label_ids ?? []);
    const [cycleId, setCycleId] = useState(issue?.cycle_id ?? '');
    const [estimateHours, setEstimateHours] = useState(issue?.estimate_hours ? String(issue.estimate_hours) : '');

    return (
        <div className='IV__modalBackdrop' onClick={onClose}>
            <div className='IV__modal' onClick={(e) => e.stopPropagation()}>
                <div className='IV__modalHeader'>
                    <h3 className='IV__modalTitle'>{issue ? `Edit ${issue.identifier}` : 'New Issue'}</h3>
                    <button onClick={onClose} className='IV__iconBtn'>{'✕'}</button>
                </div>
                <div className='IV__modalBody'>
                    <div className='IV__field'>
                        <label className='IV__label'>{'Title *'}</label>
                        <input autoFocus={true} type='text' value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Issue title' className='IV__input'/>
                    </div>
                    <div className='IV__field'>
                        <label className='IV__label'>{'Description'}</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder='Add a description...' rows={3} className='IV__input IV__input--textarea'/>
                    </div>
                    <div className='IV__fieldRow'>
                        <div className='IV__field'>
                            <label className='IV__label'>{'Status'}</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value as IssueStatus)} className='IV__input'>
                                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                        </div>
                        <div className='IV__field'>
                            <label className='IV__label'>{'Priority'}</label>
                            <select value={priority} onChange={(e) => setPriority(e.target.value as IssuePriority)} className='IV__input'>
                                {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className='IV__fieldRow'>
                        <div className='IV__field'>
                            <label className='IV__label'>{'Estimate (h)'}</label>
                            <input type='number' value={estimateHours} onChange={(e) => setEstimateHours(e.target.value)} placeholder='0' min='0' step='0.5' className='IV__input'/>
                        </div>
                        {cycles.length > 0 && (
                            <div className='IV__field'>
                                <label className='IV__label'>{'Cycle'}</label>
                                <select value={cycleId} onChange={(e) => setCycleId(e.target.value)} className='IV__input'>
                                    <option value=''>{'None'}</option>
                                    {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                    {labels.length > 0 && (
                        <div className='IV__field'>
                            <label className='IV__label'>{'Labels'}</label>
                            <div className='IV__labelPicker'>
                                {labels.map((label) => {
                                    const sel = labelIds.includes(label.id);
                                    return (
                                        <button key={label.id}
                                            onClick={() => setLabelIds((p) => p.includes(label.id) ? p.filter((x) => x !== label.id) : [...p, label.id])}
                                            className='IV__labelToggle'
                                            style={{border: `1px solid ${label.color}`, background: sel ? label.color + '30' : 'transparent', color: label.color}}
                                        >{label.name}</button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
                <div className='IV__modalFooter'>
                    <div>{issue && onDelete && <button onClick={onDelete} className='IV__btn IV__btn--danger'>{'Delete'}</button>}</div>
                    <div className='IV__modalActions'>
                        <button onClick={onClose} className='IV__btn IV__btn--ghost'>{'Cancel'}</button>
                        <button
                            onClick={() => title.trim() && onSave({title: title.trim(), description, status, priority, label_ids: labelIds, cycle_id: cycleId || undefined, estimate_hours: estimateHours ? parseFloat(estimateHours) : undefined})}
                            disabled={!title.trim()}
                            className={`IV__btn IV__btn--primary${!title.trim() ? ' IV__btn--disabled' : ''}`}
                        >{issue ? 'Save' : 'Create'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── AgentsTab (chat + git + terminal) ─────────────────────────────────────

const AgentsTab: React.FC<{activeIssue: Issue | null}> = ({activeIssue}) => (
    <div className='IV__agentsTab'>
        {/* Chat */}
        <div className='IV__chat'>
            <div className='IV__chatHeader'>
                {activeIssue ? (
                    <>
                        <span className='IV__chatIssueId'>{activeIssue.identifier}</span>
                        <span className='IV__chatIssueName'>{activeIssue.title}</span>
                        <span className='IV__chatStatusBadge' style={{background: STATUS_COLORS[activeIssue.status] + '22', color: STATUS_COLORS[activeIssue.status], border: `1px solid ${STATUS_COLORS[activeIssue.status]}44`}}>
                            {STATUS_LABELS[activeIssue.status]}
                        </span>
                    </>
                ) : <span className='IV__chatPlaceholder'>{'Select an issue'}</span>}
            </div>
            <div className='IV__chatMessages'>
                <div className='IV__chatWelcome'>
                    {activeIssue ? (
                        <>
                            <div className='IV__chatWelcomeIcon'>{'💬'}</div>
                            <div className='IV__chatWelcomeText'>{'Start the conversation about '}<strong>{activeIssue.identifier}</strong></div>
                            {activeIssue.description && <div className='IV__chatDescription'>{activeIssue.description}</div>}
                        </>
                    ) : (
                        <>
                            <div className='IV__chatWelcomeIcon'>{'📋'}</div>
                            <div className='IV__chatWelcomeText'>{'Select an issue from the sidebar to view its thread'}</div>
                        </>
                    )}
                </div>
            </div>
            <div className='IV__chatInputRow'>
                <input className='IV__chatInput' placeholder={activeIssue ? `Ask to make changes to ${activeIssue.identifier}...` : 'Select an issue to start...'} disabled={!activeIssue}/>
                <div className='IV__chatInputMeta'><span className='IV__chatModel'>{'⌘L to focus'}</span></div>
            </div>
        </div>

        {/* Right column: git + terminal */}
        <div className='IV__right'>
            <div className='IV__git'>
                <div className='IV__panelHeader'>
                    <span className='IV__panelTitle'>{'Git status'}</span>
                    <button className='IV__panelAction'>{'Create PR'}</button>
                </div>
                <div className='IV__gitBody'>
                    <div className='IV__gitItem'><span className='IV__gitDot IV__gitDot--muted'/><span className='IV__gitItemLabel'>{'No PR open'}</span><button className='IV__gitLink'>{'Create PR'}</button></div>
                    <div className='IV__gitItem'><span className='IV__gitDot IV__gitDot--warn'/><span className='IV__gitItemLabel'>{'Uncommitted changes'}</span><button className='IV__gitLink'>{'Commit'}</button></div>
                    <div className='IV__gitItem'><span className='IV__gitDot IV__gitDot--info'/><span className='IV__gitItemLabel'>{'Behind master'}</span><button className='IV__gitLink'>{'Pull'}</button></div>
                    <div className='IV__gitSection'><span className='IV__gitSectionLabel'>{'Your todos'}</span><button className='IV__gitLink'>{'+ Add'}</button></div>
                    <div className='IV__gitEmpty'>{'No todos yet'}</div>
                </div>
            </div>
            <div className='IV__terminal'>
                <div className='IV__panelHeader'>
                    <div className='IV__terminalTabs'>
                        <button className='IV__terminalTab'>{'Setup'}</button>
                        <button className='IV__terminalTab IV__terminalTab--active'>{'Run'}</button>
                        <button className='IV__terminalTab'>{'Terminal'}</button>
                        <button className='IV__terminalTab'>{'+'}</button>
                    </div>
                    <button className='IV__panelAction IV__panelAction--run'>{'▶ Run'}</button>
                </div>
                <div className='IV__terminalBody'>
                    <span className='IV__terminalPrompt'>{'$'}</span>
                    <span className='IV__terminalCursor'/>
                </div>
            </div>
        </div>
    </div>
);

// ── DiffTab ────────────────────────────────────────────────────────────────

interface DiffFile {
    path: string;
    additions: number;
    deletions: number;
    collapsed: boolean;
    hunks: DiffHunk[];
}

interface DiffHunk {
    header: string;
    lines: DiffLine[];
}

interface DiffLine {
    type: 'context' | 'add' | 'remove' | 'hunk';
    oldNum?: number;
    newNum?: number;
    content: string;
}

const HARDCODED_DIFF: DiffFile[] = [
    {
        path: 'src/renderer/components/IssuesView/IssuesView.tsx',
        additions: 47,
        deletions: 12,
        collapsed: false,
        hunks: [
            {
                header: '@@ -1,7 +1,7 @@ import React from \'react\';',
                lines: [
                    {type: 'context', oldNum: 1, newNum: 1, content: ' // Copyright (c) 2016-present Mattermost, Inc.'},
                    {type: 'context', oldNum: 2, newNum: 2, content: ' // See LICENSE.txt for license information.'},
                    {type: 'context', oldNum: 3, newNum: 3, content: ''},
                    {type: 'remove', oldNum: 4, content: "-import React, { useState } from 'react';"},
                    {type: 'add', newNum: 4, content: "+import React, { useEffect, useState, useCallback } from 'react';"},
                    {type: 'context', oldNum: 5, newNum: 5, content: ''},
                    {type: 'context', oldNum: 6, newNum: 6, content: " import './IssuesView.scss';"},
                ],
            },
            {
                header: '@@ -28,6 +28,24 @@ const STATUS_COLORS = {',
                lines: [
                    {type: 'context', oldNum: 28, newNum: 28, content: ' const STATUS_COLORS = {'},
                    {type: 'remove', oldNum: 29, content: "-    backlog: '#909399',"},
                    {type: 'remove', oldNum: 30, content: "-    in_progress: '#E6A23C',"},
                    {type: 'add', newNum: 29, content: "+    backlog: '#8b95a1',"},
                    {type: 'add', newNum: 30, content: "+    in_progress: '#f5a623',"},
                    {type: 'context', oldNum: 31, newNum: 31, content: "     done: '#3dc779',"},
                    {type: 'context', oldNum: 32, newNum: 32, content: ' };'},
                    {type: 'context', oldNum: 33, newNum: 33, content: ''},
                    {type: 'add', newNum: 34, content: '+const SubTabBar: React.FC<{active: SubTab; onChange: (t: SubTab) => void}> = ({active, onChange}) => ('},
                    {type: 'add', newNum: 35, content: '+    <div className=\'IV__subTabs\'>'},
                    {type: 'add', newNum: 36, content: '+        {([\'agents\', \'diff\', \'docs\'] as SubTab[]).map((t) => ('},
                    {type: 'add', newNum: 37, content: '+            <button key={t} className={`IV__subTab${active === t ? \' IV__subTab--active\' : \'\'}`}'},
                    {type: 'add', newNum: 38, content: '+                onClick={() => onChange(t)}>{t}</button>'},
                    {type: 'add', newNum: 39, content: '+        ))}'},
                    {type: 'add', newNum: 40, content: '+    </div>'},
                    {type: 'add', newNum: 41, content: '+);'},
                ],
            },
        ],
    },
    {
        path: 'src/renderer/components/IssuesView/IssuesView.scss',
        additions: 83,
        deletions: 5,
        collapsed: false,
        hunks: [
            {
                header: '@@ -1,10 +1,18 @@ .IssuesView {',
                lines: [
                    {type: 'context', oldNum: 1, newNum: 1, content: ' .IssuesView {'},
                    {type: 'context', oldNum: 2, newNum: 2, content: '     display: flex;'},
                    {type: 'remove', oldNum: 3, content: '-    flex: 1;'},
                    {type: 'add', newNum: 3, content: '+    flex: 1;  // fill parent height'},
                    {type: 'context', oldNum: 4, newNum: 4, content: '     height: 100%;'},
                    {type: 'context', oldNum: 5, newNum: 5, content: '     overflow: hidden;'},
                    {type: 'add', newNum: 6, content: '+    background: var(--center-channel-bg);'},
                    {type: 'add', newNum: 7, content: '+    color: var(--center-channel-color);'},
                    {type: 'context', oldNum: 6, newNum: 8, content: ' }'},
                ],
            },
        ],
    },
    {
        path: 'src/common/communication.ts',
        additions: 3,
        deletions: 0,
        collapsed: true,
        hunks: [],
    },
];

const DiffFileBlock: React.FC<{file: DiffFile}> = ({file}) => {
    const [collapsed, setCollapsed] = useState(file.collapsed);

    const addBar = Math.min(5, file.additions);
    const delBar = Math.min(5, file.deletions);

    return (
        <div className='IV__diffFile'>
            <div className='IV__diffFileHeader' onClick={() => setCollapsed((c) => !c)}>
                <span className='IV__diffFileCaret'>{collapsed ? '▸' : '▾'}</span>
                <span className='IV__diffFilePath'>{file.path}</span>
                <div className='IV__diffFileMeta'>
                    <span className='IV__diffAdd'>+{file.additions}</span>
                    <span className='IV__diffDel'>-{file.deletions}</span>
                    <div className='IV__diffBar'>
                        {Array.from({length: 5}).map((_, i) => (
                            <span key={i} className={`IV__diffBarCell ${i < addBar ? 'IV__diffBarCell--add' : i < addBar + delBar ? 'IV__diffBarCell--del' : 'IV__diffBarCell--empty'}`}/>
                        ))}
                    </div>
                </div>
                <div className='IV__diffFileActions'>
                    <button className='IV__diffFileBtn' onClick={(e) => e.stopPropagation()}>{'⧉'}</button>
                    <button className='IV__diffFileBtn' onClick={(e) => e.stopPropagation()}>{'⤢'}</button>
                    <label className='IV__diffViewed' onClick={(e) => e.stopPropagation()}>
                        <input type='checkbox'/>
                        {'Viewed'}
                    </label>
                    <button className='IV__diffFileBtn' onClick={(e) => e.stopPropagation()}>{'💬'}</button>
                    <button className='IV__diffFileBtn' onClick={(e) => e.stopPropagation()}>{'···'}</button>
                </div>
            </div>
            {!collapsed && (
                <div className='IV__diffHunks'>
                    {file.hunks.map((hunk, hi) => (
                        <div key={hi} className='IV__diffHunk'>
                            <div className='IV__diffHunkHeader'>
                                <span className='IV__diffHunkExpand'>{'⇡'}</span>
                                <span className='IV__diffHunkHeaderText'>{hunk.header}</span>
                                <span className='IV__diffHunkExpand'>{'⇣'}</span>
                            </div>
                            {hunk.lines.map((line, li) => (
                                <div key={li} className={`IV__diffLine IV__diffLine--${line.type}`}>
                                    <span className='IV__diffLineNum'>{line.oldNum ?? ''}</span>
                                    <span className='IV__diffLineNum'>{line.newNum ?? ''}</span>
                                    <span className='IV__diffLineSign'>
                                        {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                                    </span>
                                    <span className='IV__diffLineContent'>{line.content}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const DiffTab: React.FC = () => (
    <div className='IV__diffTab'>
        <div className='IV__diffHeader'>
            <span className='IV__diffSummary'>{'3 files changed'}</span>
            <span className='IV__diffSummaryAdd'>{'+133'}</span>
            <span className='IV__diffSummaryDel'>{'-17'}</span>
        </div>
        <div className='IV__diffBody'>
            {HARDCODED_DIFF.map((file) => <DiffFileBlock key={file.path} file={file}/>)}
        </div>
    </div>
);

// ── DocsTab ────────────────────────────────────────────────────────────────

const DocsTab: React.FC<{issue: Issue | null; labelsMap: Record<string, IssueLabel>}> = ({issue, labelsMap}) => {
    if (!issue) {
        return (
            <div className='IV__docsEmpty'>
                <div className='IV__docsEmptyIcon'>{'📄'}</div>
                <div className='IV__docsEmptyText'>{'Select an issue to view its document'}</div>
            </div>
        );
    }

    const issueLabels = (issue.label_ids || []).map((id) => labelsMap[id]).filter(Boolean);

    return (
        <div className='IV__docs'>
            <div className='IV__docsContent'>
                <div className='IV__docsMeta'>
                    <span className='IV__docsMetaItem IV__docsMetaItem--status' style={{background: STATUS_COLORS[issue.status] + '22', color: STATUS_COLORS[issue.status], border: `1px solid ${STATUS_COLORS[issue.status]}44`}}>
                        {STATUS_LABELS[issue.status]}
                    </span>
                    <span className='IV__docsMetaItem IV__docsMetaItem--priority' style={{color: PRIORITY_COLORS[issue.priority]}}>
                        {PRIORITY_ICONS[issue.priority]} {PRIORITY_LABELS[issue.priority]}
                    </span>
                    <span className='IV__docsMetaItem IV__docsMetaItem--id'>{issue.identifier}</span>
                    {issueLabels.map((label) => (
                        <span key={label.id} className='IV__docsMetaItem' style={{background: label.color + '22', color: label.color, border: `1px solid ${label.color}44`}}>{label.name}</span>
                    ))}
                    {issue.estimate_hours > 0 && (
                        <span className='IV__docsMetaItem IV__docsMetaItem--estimate'>{'⏱ '}{issue.estimate_hours}{'h estimate'}</span>
                    )}
                </div>

                <h1 className='IV__docsTitle'>{issue.title}</h1>

                {issue.description ? (
                    <div className='IV__docsSection'>
                        <h2 className='IV__docsH2'>{'Overview'}</h2>
                        <p className='IV__docsText'>{issue.description}</p>
                    </div>
                ) : (
                    <div className='IV__docsSection'>
                        <h2 className='IV__docsH2'>{'Overview'}</h2>
                        <p className='IV__docsText IV__docsText--placeholder'>{'No description provided. Click to add one...'}</p>
                    </div>
                )}

                <div className='IV__docsSection'>
                    <h2 className='IV__docsH2'>{'Acceptance criteria'}</h2>
                    <ul className='IV__docsList'>
                        <li className='IV__docsListItem'>{'[ ] Define the expected behavior'}</li>
                        <li className='IV__docsListItem'>{'[ ] Cover edge cases'}</li>
                        <li className='IV__docsListItem'>{'[ ] Write tests'}</li>
                    </ul>
                </div>

                <div className='IV__docsSection'>
                    <h2 className='IV__docsH2'>{'Notes'}</h2>
                    <p className='IV__docsText IV__docsText--placeholder'>{'Add implementation notes, links, or context here...'}</p>
                </div>
            </div>
        </div>
    );
};

// ── SubTabBar ──────────────────────────────────────────────────────────────

const SubTabBar: React.FC<{active: SubTab; onChange: (t: SubTab) => void}> = ({active, onChange}) => (
    <div className='IV__subTabs'>
        {(['agents', 'diff', 'docs'] as SubTab[]).map((t) => (
            <button
                key={t}
                className={`IV__subTab${active === t ? ' IV__subTab--active' : ''}`}
                onClick={() => onChange(t)}
            >
                {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
        ))}
    </div>
);

// ── IssueSidebar (left panel, always visible) ─────────────────────────────

interface IssueSidebarProps {
    projects: Project[];
    activeProjectId: string;
    issues: Issue[];
    labelsMap: Record<string, IssueLabel>;
    filters: IssueFilters;
    loading: boolean;
    activeIssueId: string | null;
    onSelectProject: (id: string) => void;
    onCreateProject: (data: {name: string; prefix: string}) => void;
    onNewIssue: () => void;
    onClickIssue: (issue: Issue) => void;
    onFiltersChange: (f: IssueFilters) => void;
    cycles: Cycle[];
}

const IssueSidebar: React.FC<IssueSidebarProps> = ({
    projects, activeProjectId, issues, labelsMap, filters, loading, activeIssueId,
    onSelectProject, onCreateProject, onNewIssue, onClickIssue, onFiltersChange, cycles,
}) => {
    const filtered = issues.filter((issue) => {
        if (filters.status && issue.status !== filters.status) { return false; }
        if (filters.priority && issue.priority !== filters.priority) { return false; }
        if (filters.cycleId && issue.cycle_id !== filters.cycleId) { return false; }
        if (filters.searchQuery) {
            const q = filters.searchQuery.toLowerCase();
            if (!issue.title.toLowerCase().includes(q) && !issue.identifier?.toLowerCase().includes(q)) { return false; }
        }
        return true;
    });

    const groupedIssues = (() => {
        const gb = filters.groupBy || 'status';
        if (gb === 'none') { return {all: filtered}; }
        const order = gb === 'status' ? STATUS_ORDER : gb === 'priority' ? PRIORITY_ORDER : [];
        const map: Record<string, Issue[]> = {};
        order.forEach((k) => { map[k] = []; });
        filtered.forEach((issue) => {
            const key = gb === 'status' ? issue.status : gb === 'priority' ? issue.priority : gb === 'cycle' ? (issue.cycle_id || 'no_cycle') : 'all';
            if (!map[key]) { map[key] = []; }
            map[key].push(issue);
        });
        return map;
    })();

    return (
        <div className='IV__sidebar'>
            <div className='IV__sidebarHeader'>
                <ProjectSelector
                    projects={projects}
                    activeProjectId={activeProjectId}
                    onSelect={onSelectProject}
                    onCreate={onCreateProject}
                />
                <button
                    onClick={onNewIssue}
                    disabled={!activeProjectId}
                    className={`IV__btn IV__btn--primary IV__btn--sm${!activeProjectId ? ' IV__btn--disabled' : ''}`}
                >{'+ New'}</button>
            </div>
            <div className='IV__sidebarFilters'>
                <input
                    type='text'
                    placeholder='Search issues...'
                    value={filters.searchQuery || ''}
                    onChange={(e) => onFiltersChange({...filters, searchQuery: e.target.value})}
                    className='IV__input IV__input--search'
                />
                <div className='IV__filterRow'>
                    <select value={filters.status || ''} onChange={(e) => onFiltersChange({...filters, status: (e.target.value || undefined) as IssueStatus | undefined})} className='IV__filterSelect'>
                        <option value=''>{'All stati'}</option>
                        {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select value={filters.priority || ''} onChange={(e) => onFiltersChange({...filters, priority: (e.target.value || undefined) as IssuePriority | undefined})} className='IV__filterSelect'>
                        <option value=''>{'All prio'}</option>
                        {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <label className='IV__groupByLabel'>
                        {'Group:'}
                        <select value={filters.groupBy} onChange={(e) => onFiltersChange({...filters, groupBy: e.target.value as GroupBy})} className='IV__filterSelect'>
                            <option value='status'>{'Status'}</option>
                            <option value='priority'>{'Priority'}</option>
                            <option value='cycle'>{'Cycle'}</option>
                            <option value='none'>{'None'}</option>
                        </select>
                    </label>
                </div>
            </div>
            <div className='IV__sidebarList'>
                {loading ? (
                    <div className='IV__loading'>{'Loading...'}</div>
                ) : (
                    <IssueList
                        groupedIssues={groupedIssues}
                        labels={labelsMap}
                        filters={filters}
                        activeIssueId={activeIssueId}
                        onClickIssue={onClickIssue}
                    />
                )}
            </div>
        </div>
    );
};

// ── Main IssuesView ────────────────────────────────────────────────────────

const IssuesView: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProjectId, setActiveProjectId] = useState('');
    const [issues, setIssues] = useState<Issue[]>([]);
    const [labelsMap, setLabelsMap] = useState<Record<string, IssueLabel>>({});
    const [labelsList, setLabelsList] = useState<IssueLabel[]>([]);
    const [cycles, setCycles] = useState<Cycle[]>([]);
    const [filters, setFilters] = useState<IssueFilters>({groupBy: 'status'});
    const [loading, setLoading] = useState(true);
    const [modalIssue, setModalIssue] = useState<Issue | null | undefined>(undefined);
    const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
    const [subTab, setSubTab] = useState<SubTab>('agents');
    const initialized = useRef(false);

    const fetchProjects = useCallback(async () => {
        try {
            const data = await api<Project[]>('GET', '/projects');
            setProjects(data || []);
            if (data && data.length > 0) { setActiveProjectId((prev) => prev || data[0].id); }
        } catch { /* plugin not installed */ } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (!initialized.current) { initialized.current = true; fetchProjects(); }
    }, [fetchProjects]);

    useEffect(() => {
        if (!activeProjectId) { return; }
        (async () => {
            try {
                const [issueResp, lbls, cycs] = await Promise.all([
                    api<{issues: Issue[]} | Issue[]>('GET', `/projects/${activeProjectId}/issues`),
                    api<IssueLabel[]>('GET', `/projects/${activeProjectId}/labels`),
                    api<Cycle[]>('GET', `/projects/${activeProjectId}/cycles`),
                ]);
                const issueList = Array.isArray(issueResp) ? issueResp : (issueResp as any).issues || [];
                setIssues(issueList);
                const lmap: Record<string, IssueLabel> = {};
                (lbls || []).forEach((l) => { lmap[l.id] = l; });
                setLabelsMap(lmap); setLabelsList(lbls || []); setCycles(cycs || []);
            } catch { /* ignore */ }
        })();
    }, [activeProjectId]);

    const handleSaveIssue = async (data: Partial<Issue>) => {
        if (modalIssue) {
            const updated = await api<Issue>('PUT', `/issues/${modalIssue.id}`, data);
            setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        } else {
            const created = await api<Issue>('POST', `/projects/${activeProjectId}/issues`, data);
            setIssues((prev) => [created, ...prev]);
        }
        setModalIssue(undefined);
    };

    const handleDeleteIssue = async () => {
        if (!modalIssue) { return; }
        if (window.confirm(`Delete "${modalIssue.identifier} ${modalIssue.title}"?`)) {
            await api('DELETE', `/issues/${modalIssue.id}`);
            setIssues((prev) => prev.filter((i) => i.id !== modalIssue.id));
            if (activeIssue?.id === modalIssue.id) { setActiveIssue(null); }
            setModalIssue(undefined);
        }
    };

    return (
        <div className='IssuesView'>
            {/* ── Left sidebar (always visible) ── */}
            <IssueSidebar
                projects={projects}
                activeProjectId={activeProjectId}
                issues={issues}
                labelsMap={labelsMap}
                filters={filters}
                loading={loading}
                activeIssueId={activeIssue?.id ?? null}
                onSelectProject={setActiveProjectId}
                onCreateProject={async (data) => {
                    const proj = await api<Project>('POST', '/projects', data);
                    setProjects((prev) => [...prev, proj]);
                    setActiveProjectId(proj.id);
                }}
                onNewIssue={() => setModalIssue(null)}
                onClickIssue={(issue) => setActiveIssue((prev) => (prev?.id === issue.id ? null : issue))}
                onFiltersChange={setFilters}
                cycles={cycles}
            />

            {/* ── Main area with subtab bar ── */}
            <div className='IV__main'>
                <SubTabBar active={subTab} onChange={setSubTab}/>
                <div className='IV__mainContent'>
                    {subTab === 'agents' && <AgentsTab activeIssue={activeIssue}/>}
                    {subTab === 'diff' && <DiffTab/>}
                    {subTab === 'docs' && <DocsTab issue={activeIssue} labelsMap={labelsMap}/>}
                </div>
            </div>

            {modalIssue !== undefined && (
                <CreateIssueModal
                    issue={modalIssue}
                    labels={labelsList}
                    cycles={cycles}
                    onSave={handleSaveIssue}
                    onDelete={modalIssue ? handleDeleteIssue : undefined}
                    onClose={() => setModalIssue(undefined)}
                />
            )}
        </div>
    );
};

export default IssuesView;
