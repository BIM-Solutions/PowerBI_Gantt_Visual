import * as React from "react";
import { makeStyles, shorthands, tokens } from "@fluentui/react-components";
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { ChevronDown16Regular, ChevronRight16Regular } from "@fluentui/react-icons";

export type Task = {
    id: string;
    group: string;
    owner: string;
    name: string;
    start: Date | null;
    end: Date | null;
    progress: number;
    color: string;
    legendValue: string;
    label: string;
    identity?: any;
    // Additional dynamic fields
    [key: string]: any;
};

// New prop for additional columns
type GanttChartProps = {
    width: number;
    height: number;
    tasks: Task[];
    additionalColumns: { key: string; displayName: string; format?: string }[];
    labelDisplayName?: string;
    labelParentName?: string;
    legendPosition?: 'top' | 'bottom' | 'left' | 'right';
    legendFontSize?: number;
    selectionManager?: any; // Will type properly after import
    host?: any; // Will type properly after import
};

const useStyles = makeStyles({
    root: {
        ...shorthands.padding("16px"),
        backgroundColor: tokens.colorNeutralBackground1,
        width: "100%",
        height: "100%",
        fontFamily: "Segoe UI, Arial, sans-serif",
        fontSize: "14px"
    },
    tableHeader: {
        fontWeight: 700,
        fill: tokens.colorNeutralForeground1,
        // fontSize: 14,
    },
    rowHeader: {
        textAnchor: "start",
        fontWeight: 600,
        fill: tokens.colorNeutralForeground1,
        cursor: "default",
        zIndex: 1000
    },
    bar: {
        opacity: 0.9,
        cursor: "pointer"
    },
    gridLine: {
        stroke: "#e1e1e1"
    },
    altRow: {
        fill: "#fafafa"
    },
    tooltip: {
        position: "absolute",
        background: "#fff",
        border: "1px solid #ccc",
        // borderRadius: 4,
        padding: "8px 12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        pointerEvents: "none",
        zIndex: 1000,
        color: "#222"
    },
    legend: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "16px",
        marginBottom: "8px",
        marginLeft: "8px"
    },
    legendItem: {
        display: "flex",
        alignItems: "center",
        gap: "6px"
    },
    legendSwatch: {
        // width: 16,
        // height: 16,
        // borderRadius: 4,
        display: "inline-block"
    },
    headerSvg: {
        display: "block",
        background: "#fff"
    },
    scrollBody: {
        overflowY: "auto",
        overflowX: "hidden",
        width: "100%",
        background: "#fff"
        
    }
});

// Custom label for slider handle
// const SliderLabel: React.FC<{ position: number; value: string }> = ({ position, value }) => (
//   <div
//     style={{
//       position: 'absolute',
//       left: position - 30, // adjust for label width
//       top: -32,
//       width: 60,
//       textAlign: 'center',
//       fontSize: 12,
//       color: '#222',
//       pointerEvents: 'none',
//       background: '#fff',
//       borderRadius: 4,
//       boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
//     }}
//   >
//     {value}
//   </div>
// );

export const GanttChart: React.FC<GanttChartProps> = ({ width, height, tasks, additionalColumns, labelDisplayName, labelParentName, legendPosition = 'top', legendFontSize = 14, selectionManager, host }) => {
    // console.log('GanttChart additionalColumns:', additionalColumns);
    // console.log('GanttChart tasks sample:', tasks.slice(0, 3));
    const styles = useStyles();
    const [tooltip, setTooltip] = React.useState<null | { x: number; y: number; content: string }>(null);
    const [zoom, setZoom] = React.useState({ start: 0, end: 1 }); // 0-1 range
    const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({});

    // Deduplicate tasks by id (or id+legendValue if you want one per legend)
    const seen = new Set();
    const dedupedTasks = tasks.filter(task => {
        const key = `${task.id}`; // or `${task.id}-${task.legendValue}`
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Group by parent (group)
    const grouped = React.useMemo(() => {
        const map: Record<string, Task[]> = {};
        for (const t of tasks) {
            const parents = t.group.split(','); // Handles multiple group assignments
            parents.forEach(parent => {
                parent = parent.trim();
                if (!map[parent]) map[parent] = [];
                map[parent].push(t);
            });
        }
        return map;
    }, [tasks]);

    // Flatten for rendering: parent row, then item row (one per task)
    const flatRows: { type: "parent" | "item"; parent: string; task?: Task }[] = [];
    Object.entries(grouped).forEach(([parent, tasks]) => {
        flatRows.push({ type: "parent", parent });
        if (expandedGroups[parent] !== false) {
            tasks.forEach(task => {
                flatRows.push({ type: "item", parent, task });
            });
        }
    });

    // Calculate min/max dates
    const validTasks = tasks.filter(t => t.start && t.end);
    const allMinDate = validTasks.length ? new Date(Math.min(...validTasks.map(t => t.start!.getTime()))) : new Date();
    const allMaxDate = validTasks.length ? new Date(Math.max(...validTasks.map(t => t.end!.getTime()))) : new Date();
    const totalMs = allMaxDate.getTime() - allMinDate.getTime();
    const minDate = new Date(allMinDate.getTime() + zoom.start * totalMs);
    const maxDate = new Date(allMinDate.getTime() + zoom.end * totalMs);

    // Chart layout
    const leftColWidth = 220 + additionalColumns.length * 110;
    const rowHeight = 28;
    const barHeight = 18;
    const chartPaddingLeft = 16;
    const chartPaddingRight = 16;
    const chartPaddingBottom = 16;
    const chartWidth = width - leftColWidth - chartPaddingLeft - chartPaddingRight;
    const chartHeight = flatRows.length * rowHeight + chartPaddingBottom;
    const headerHeight = 56; // header SVG height (date axis + column headers)
    const zoomBarHeight = 60; // zoom bar height
    // const chartBodyHeight = Math.max(80, height - headerHeight - zoomBarHeight - 8); // 8px margin
    // subtract slider container height (48px) + its margin (8px) from the scrollBody
    const chartBodyHeight = height
    - headerHeight
    - zoomBarHeight
    - /* slider container height */ 48
    - /* slider marginTop */ 8;

    // Indentation
    const getIndent = (type: "parent" | "item") =>
        type === "parent" ? 0 : 16;

    // Vertical offset for row content
    const rowYOffset = rowHeight / 2 + 4;
    const barYOffset = (rowHeight - barHeight) / 2;

    // Date to X coordinate
    const dateToX = (date: Date) =>
        ((date.getTime() - minDate.getTime()) / (maxDate.getTime() - minDate.getTime())) * chartWidth + leftColWidth + chartPaddingLeft;

    // Render date axis (months & weeks)
    const months: { x: number; label: string }[] = [];
    if (validTasks.length) {
        let d = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        while (d <= maxDate) {
            months.push({
                x: dateToX(d),
                label: d.toLocaleString("default", { month: "short", year: "numeric" })
            });
            d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        }
    }
    // Weeks (optional, for finer grid)
    const weeks: { x: number; label: string }[] = [];
    if (validTasks.length) {
        let d = new Date(minDate);
        d.setDate(d.getDate() - d.getDay()); // start of week
        while (d <= maxDate) {
            weeks.push({
                x: dateToX(d),
                label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
            });
            d = new Date(d);
            d.setDate(d.getDate() + 7);
        }
    }

    // Tooltip handlers
    const handleBarMouseOver = (e: React.MouseEvent, task: Task) => {
        setTooltip({
            x: e.clientX + 10,
            y: e.clientY + 10,
            content: `<b>${task.name}</b><br/>${labelParentName}: ${task.group}<br/>Start: ${task.start?.toLocaleDateString()}<br/>End: ${task.end?.toLocaleDateString()}<br/>Progress: ${Math.round(task.progress * 100)}%` +
                (labelDisplayName ? `<br/>${labelDisplayName}: ${task.label}<br/>` : "") +
                additionalColumns.map(col => `<br/><b>${col.displayName}:</b> ${task[col.key] ?? ""}`).join("")
        });
    };
    const handleBarMouseOut = () => setTooltip(null);

    // Dynamic legend (by legendValue)
    const legendMap: Record<string, string> = {};
    tasks.forEach(t => {
        if (t.legendValue && !legendMap[t.legendValue]) legendMap[t.legendValue] = t.color;
    });
    const legendEntries = Object.entries(legendMap);
    
    // Calculate today's X position
    const today = new Date();
    const todayX = dateToX(today);

    // Legend rendering based on position and font size
    const legend = legendEntries.length > 0 && (
        <div
            className={styles.legend}
            style={{
                flexDirection: legendPosition === "left" || legendPosition === "right" ? "column" : "row",
                fontSize: legendFontSize,
                alignItems: "center",
                justifyContent: "flex-start",
                marginBottom: legendPosition === "top" ? 8 : 0,
                marginTop: legendPosition === "bottom" ? 8 : 0,
                marginLeft: legendPosition === "left" ? 8 : 0,
                marginRight: legendPosition === "right" ? 8 : 0,
            }}
        >
            {legendEntries.map(([val, color]) => (
                <span key={val} className={styles.legendItem}>
                    <span
                        className={styles.legendSwatch}
                        style={{ width: 16, height: 16, borderRadius: 4, display: "inline-block", background: color }}
                    />
                    <span>{val}</span>
                </span>
            ))}
        </div>
    );

    // Selection/context menu handlers
    const handleBarClick = async (e: React.MouseEvent, task: Task) => {
        console.log("Clicked task identity:", task.identity);
        if (selectionManager && host && task.identity) {
            await selectionManager.select([task.identity], false);
        }
    };
    const handleBarContextMenu = (e: React.MouseEvent, task: Task) => {
        if (selectionManager && host) {
            e.preventDefault();
            const selectionId = host.createSelectionId ? host.createSelectionId() : null;
            // TODO: Attach identity if available
            if (selectionId && host.launchContextMenu) {
                host.launchContextMenu(selectionId, { x: e.clientX, y: e.clientY });
            }
        }
    };

    return (
        <div className={styles.root} style={{ position: "relative", height }}>
            {/* Legend in selected position */}
            {(legendPosition === "top" || !legendPosition) && legend}
            {/* Header SVG: date axis and column headers */}
            <svg width={Math.max(width, chartWidth + leftColWidth + chartPaddingLeft + chartPaddingRight)} height={headerHeight} className={styles.headerSvg}>
            
                {/* Date axis (top) */}
                {months.map((m, i) => (
                    <g key={i}>
                        <text x={m.x + 4} y={22} fontSize={12} fill="#888">{m.label}</text>
                        <line x1={m.x} y1={22} x2={m.x} y2={headerHeight} className={styles.gridLine} strokeDasharray="4 2" strokeWidth={1} />
                    </g>
                ))}
                {/* Weeks grid lines (lighter) */}
                {weeks.map((w, i) => (
                    <line key={i} x1={w.x} y1={0} x2={w.x} y2={headerHeight} stroke="#f0f0f0" strokeDasharray="2 2" strokeWidth={1} />
                ))}
                {/* Bottom axis */}
                <line x1={leftColWidth} y1={headerHeight - 1} x2={width - chartPaddingRight} y2={headerHeight - 1} stroke="#bbb" strokeWidth={1.5} />
                <text x={leftColWidth} y={headerHeight - 4} fontSize={12} fill="#888">{minDate.toLocaleDateString()}</text>
                <text x={width - chartPaddingRight - 60} y={headerHeight - 4} fontSize={12} fill="#888">{maxDate.toLocaleDateString()}</text>
                {/* Today's date line */}
                <line
                    x1={todayX}
                    y1={0}
                    x2={todayX}
                    y2={headerHeight}
                    stroke="#d83b01"
                    strokeWidth={2}
                    // strokeDasharray="4 2"
                />
                <text
                    x={todayX + 4}
                    y={12}
                    fontSize={11}
                    fill="#d83b01"
                    fontWeight={700}
                >
                    {new Date().toLocaleDateString()}
                </text>
                {/* White overlay for left column */}
                <rect
                    x={0}
                    y={0}
                    width={leftColWidth}
                    height={headerHeight}
                    fill="#fff"
                    style={{ pointerEvents: "none" }}
                />
                {/* Table headers for left panel */}
                <g>
                    <text x={8} y={headerHeight - 24} className={styles.tableHeader}>{labelParentName}</text>
                    <text x={120} y={headerHeight - 24} className={styles.tableHeader}>Item</text>
                    {additionalColumns.map((col, idx) => (
                        <text key={col.key} x={220 + idx * 110} y={headerHeight - 24} className={styles.tableHeader}>{col.displayName}</text>
                    ))}
                </g>
                
            </svg>
            {/* Scrollable chart body */}
            <div className={styles.scrollBody} style={{ maxHeight: chartBodyHeight, height: chartBodyHeight }}>
                <svg width={Math.max(width, chartWidth + leftColWidth + chartPaddingLeft + chartPaddingRight)} height={chartHeight}>
                    {/* Date axis (top) */}
                    {months.map((m, i) => (
                        <g key={i}>
                            {/* <text x={m.x + 4} y={chartPadding - 4} fontSize={12} fill="#888">{m.label}</text> */}
                            <line x1={m.x} y1={0} x2={m.x} y2={chartHeight - chartPaddingBottom} className={styles.gridLine} strokeDasharray="4 2" strokeWidth={1} />
                        </g>
                    ))}
                    {/* Weeks grid lines (lighter) */}
                    {weeks.map((w, i) => (
                        <line key={i} x1={w.x} y1={0} x2={w.x} y2={chartHeight - chartPaddingBottom} stroke="#f0f0f0" strokeDasharray="2 2" strokeWidth={1} />
                    ))}
                    {/* Horizontal grid lines for each row */}
                    {flatRows.map((row, i) => (
                        <line
                            key={`horiz-${i}`}
                            x1={leftColWidth}
                            y1={i * rowHeight}
                            x2={width - chartPaddingRight}
                            y2={i * rowHeight}
                            stroke="#e1e1e1"
                            strokeWidth={1}
                        />
                    ))}
                    {/* Bottom axis */}
                    <line x1={leftColWidth} y1={chartHeight - chartPaddingBottom} x2={width - chartPaddingRight} y2={chartHeight - chartPaddingBottom} stroke="#bbb" strokeWidth={1.5} />
                    <text x={leftColWidth} y={chartHeight - chartPaddingBottom + 18} fontSize={12} fill="#888">{minDate.toLocaleDateString()}</text>
                    <text x={width - chartPaddingRight - 60} y={chartHeight - chartPaddingBottom + 18} fontSize={12} fill="#888">{maxDate.toLocaleDateString()}</text>
                    {/* Today's date line */}
                    <line
                        x1={todayX}
                        y1={0}
                        x2={todayX}
                        y2={chartHeight - chartPaddingBottom}
                        stroke="#d83b01"
                        strokeWidth={2}
                        // strokeDasharray="4 2"
                    />
                    {/* White overlay for left column */}
                    <rect
                        x={0}
                        y={0}
                        width={leftColWidth}
                        height={chartHeight}
                        fill="#fff"
                        style={{ pointerEvents: "none" }}
                    />
                    {/* Render all left column text/labels/items/groups/additional columns here */}
                    {flatRows.map((row, i) => (
                        <g key={i}>
                            {/* Parent (group) row */}
                            {row.type === "parent" && (
                                <>
                                    <g
                                        style={{ cursor: "pointer" }}
                                        onClick={() => setExpandedGroups(exp => ({ ...exp, [row.parent]: exp[row.parent] === false }))}
                                    >
                                        {/* Transparent rect for larger click area */}
                                        <rect
                                            x={0}
                                            y={i * rowHeight}
                                            width={leftColWidth}
                                            height={rowHeight}
                                            fill="transparent"
                                        />
                                        {expandedGroups[row.parent] === false ? (
                                            <ChevronRight16Regular style={{ position: "absolute" }} x={8} y={i * rowHeight + rowYOffset - 12} />
                                        ) : (
                                            <ChevronDown16Regular style={{ position: "absolute" }} x={8} y={i * rowHeight + rowYOffset - 12} />
                                        )}
                                        <text
                                            x={28}
                                            y={i * rowHeight + rowYOffset}
                                            fontWeight={700}
                                            fontSize={15}
                                            fill="#222"
                                            className={styles.rowHeader}
                                        >
                                            {row.parent || "Not Assigned"}
                                        </text>
                                    </g>
                                </>
                            )}
                            {/* Item row: show item name, bar, and additional columns */}
                            {row.type === "item" && row.task && (
                                <>
                                    <text
                                        x={getIndent("item") + 8}
                                        y={i * rowHeight + rowYOffset}
                                        fontWeight={600}
                                        fontSize={13}                                       
                                        fill={row.task.name === "Not Assigned" ? "red" : "#222"} // Ensure this is set correctly
                                        style={{ fill: row.task.name  ? "#222" : "red" , zIndex: 1000000}}
                                    >
                                        {row.task.name || "Not Assigned"}
                                    </text>
                                    {additionalColumns.map((col, idx) => {
                                        let value = row.task[col.key];
                                        // Format if it's a date and a format string is provided
                                        console.log("col.format", col.format);
                                            console.log("value", value);
                                        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
                                            // Example: use toLocaleDateString for 'Short Date'
                                            console.log("col.format", col.format);
                                            console.log("value", value);
                                            value = new Date(value).toLocaleDateString();
                                        }
                                        return (
                                            <text
                                                key={col.key}
                                                x={220 + idx * 110}
                                                y={i * rowHeight + rowYOffset}
                                                fontSize={12}
                                                fill="#444"
                                            >
                                                {value ?? ""}
                                            </text>
                                        );
                                    })}
                                    
                                    {/* Task bar */}
                                    {row.task.start && row.task.end && (
                                        <g>
                                            {(() => {
                                                const barStartX = Math.max(dateToX(row.task.start), leftColWidth);
                                                const barEndX = dateToX(row.task.end);
                                                const barWidth = Math.max(2, barEndX - barStartX);
                                                const progressWidth = Math.max(2, (barEndX - barStartX) * row.task.progress);
                                                const barCenterX = barStartX + barWidth / 2;
                                                return (
                                                    <>
                                                        <rect
                                                            className={styles.bar}
                                                            x={barStartX}
                                                            y={i * rowHeight + barYOffset}
                                                            width={barWidth}
                                                            height={barHeight}
                                                            rx={4}
                                                            fill={row.task.color}
                                                            onMouseOver={e => handleBarMouseOver(e, row.task!)}
                                                            onMouseOut={handleBarMouseOut}
                                                            onClick={e => handleBarClick(e, row.task!)}
                                                            onContextMenu={e => handleBarContextMenu(e, row.task!)}
                                                        />
                                                        {/* Progress overlay (darker shade) */}
                                                        <rect
                                                            x={barStartX}
                                                            y={i * rowHeight + barYOffset}
                                                            width={progressWidth}
                                                            height={barHeight}
                                                            rx={4}
                                                            fill="#000"
                                                            opacity={0.18}
                                                        />
                                                        {/* Progress label inside bar */}
                                                        <text
                                                            x={barStartX + 8}
                                                            y={i * rowHeight + rowYOffset}
                                                            fontSize={12}
                                                            fill="#fff"
                                                            fontWeight={700}
                                                            pointerEvents="none"
                                                        >
                                                            {row.task.progress > 0 ? `${Math.round(row.task.progress * 100)}%` : "0%"}
                                                        </text>
                                                        {/* Centered label inside bar */}
                                                        <text
                                                            x={barCenterX}
                                                            y={i * rowHeight + rowYOffset}
                                                            fontSize={12}
                                                            fill="#333"
                                                            fontWeight={700}
                                                            pointerEvents="none"
                                                            textAnchor="middle"
                                                        >
                                                            {barWidth > 75 ? row.task.label : ""}
                                                        </text>
                                                    </>
                                                );
                                            })()}
                                        </g>
                                    )}
                                </>
                            )}
                        </g>
                    ))}
                </svg>
            </div>
            {/* Tooltip */}
            {tooltip && (
                <div
                    className={styles.tooltip}
                    style={{ left: tooltip.x, top: tooltip.y, pointerEvents: "none" }}
                    dangerouslySetInnerHTML={{ __html: tooltip.content }}
                />
            )}
            {/* Zoom bar at the bottom */}
            <div style={{ width: "auto", marginTop: 8, marginBottom: 0, background: "transparent", zIndex: 1000, position: "relative", paddingRight: "45px", paddingLeft: `${leftColWidth - chartPaddingLeft}px`}}>
                <Slider
                    range
                    min={0}
                    max={100}
                    value={[Math.round(zoom.start * 100), Math.round(zoom.end * 100)]}
                    onChange={val => {
                        if (Array.isArray(val)) {
                            const [start, end] = val;
                            setZoom({ start: start / 100, end: end / 100 });
                        }
                    }}
                    allowCross={false}
                    handleRender={(node, props) => {
                        // Map value (0-100) to date
                        const percent = props.value / 100;
                        const date = new Date(allMinDate.getTime() + percent * (allMaxDate.getTime() - allMinDate.getTime()));
                        // Position is in px from left of slider
                        return (
                            <div style={{ position: 'relative' }}>
                                {node}
                                <div style={{ position: 'absolute', left: 0, top: 16, width: 60, textAlign: 'center', fontSize: 12, color: '#222', pointerEvents: 'none', background: '#fff', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                                    {minDate.toLocaleDateString()}
                                </div>
                                <div style={{ position: 'absolute', right: 0, top: 16, width: 60, textAlign: 'center', fontSize: 12, color: '#222', pointerEvents: 'none', background: '#fff', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                                    {maxDate.toLocaleDateString()}
                                </div>
                            </div>
                        );
                    }}
                />
            </div>
            {legendPosition === "bottom" && legend}
            {legendPosition === "left" && (
                <div style={{ position: "absolute", left: 0, top: headerHeight, zIndex: 10 }}>{legend}</div>
            )}
            {legendPosition === "right" && (
                <div style={{ position: "absolute", right: 0, top: headerHeight, zIndex: 10 }}>{legend}</div>
            )}
        </div>
    );
};
