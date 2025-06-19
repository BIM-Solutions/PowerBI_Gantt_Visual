import * as React from "react";
import 'rc-slider/assets/index.css';
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
    [key: string]: any;
};
type GanttChartProps = {
    width: number;
    height: number;
    tasks: Task[];
    additionalColumns: {
        key: string;
        displayName: string;
        format?: string;
    }[];
    labelDisplayName?: string;
    labelParentName?: string;
    labelItemName?: string;
    legendPosition?: 'top' | 'bottom' | 'left' | 'right';
    legendFontSize?: number;
    selectionManager?: any;
    host?: any;
    selectedIds?: any[];
};
export declare const GanttChart: React.FC<GanttChartProps>;
export {};
