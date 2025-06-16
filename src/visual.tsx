/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { GanttChart, Task } from "./components/GanttCHart";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;

import { VisualFormattingSettingsModel } from "./settings";

export class Visual implements IVisual {
    private root: ReactDOM.Root;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private selectionManager: ISelectionManager;
    private host: VisualHost;

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.root = ReactDOM.createRoot(options.element);
        this.host = options.host as VisualHost;
        this.selectionManager = this.host.createSelectionManager();
    }

    public update(options: VisualUpdateOptions) {
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            options.dataViews[0]
        );

        const dataView = options.dataViews[0];
        const rows = dataView.table.rows;
        const columns = dataView.table.columns;
        // console.log('Power BI columns:', columns);

        // Helper to get column index by role
        const getColumnIndex = (roleName: string) =>
            columns.findIndex(col => col.roles && col.roles[roleName]);

        const itemIdx = getColumnIndex("item");
        const parentIdx = getColumnIndex("parent");
        const itemNameIdx = getColumnIndex("itemName");
        const startIdx = getColumnIndex("startDate");
        const endIdx = getColumnIndex("endDate");
        const progressIdx = getColumnIndex("progress");
        const legendIdx = getColumnIndex("legend");
        const labelIdx = getColumnIndex("label");
        const additionalColumnsIdx = getColumnIndex("additionalColumns");
        const legendValueIdx = getColumnIndex("legendValue");

        // Helper to safely get a string value
        const getString = (val: any) => (val === null || val === undefined ? "" : String(val));
        // Helper to safely get a number value
        const getNumber = (val: any) => {
            const n = Number(val);
            return isNaN(n) ? 0 : n;
        };
        // Helper to safely get a date value
        const getDate = (val: any) => {
            if (!val) return null;
            if (val instanceof Date) return val;
            if (typeof val === "string" || typeof val === "number") {
                const d = new Date(val);
                return isNaN(d.getTime()) ? null : d;
            }
            return null;
        };

        // Assign a color for each legend value (simple hash for demo)
        const colorPalette = [
            "#0078d4", "#e3008c", "#ffaa44", "#00b7c3", "#bad80a", "#b146c2", "#ff8c00", "#a80000"
        ];
        const legendColorMap: Record<string, string> = {};
        let colorIdx = 0;

        const mainRoles = ["item", "parent", "itemName", "startDate", "endDate", "progress", "legend", "label", "legendValue"];
        const additionalColumns = columns
            .filter(col => col.roles && col.roles["additionalColumns"])
            .map(col => ({ key: col.queryName, displayName: col.displayName, idx: col.index, format: col.format }));
        const labelDisplayName = labelIdx >= 0 ? columns[labelIdx].displayName : "Label";
        const labelParentName = parentIdx >= 0 ? columns[parentIdx].displayName : "Parent";
        
        const identities = dataView.table.identity; // array of DataViewScopeIdentity
        const tasks: Task[] = rows.map((row, i) => {
            const legendValue = legendIdx >= 0 ? getString(row[legendIdx]) : "";
            if (legendValue && !legendColorMap[legendValue]) {
                legendColorMap[legendValue] = colorPalette[colorIdx % colorPalette.length];
                colorIdx++;
            }
            // Build the base task
            const task: Task = {
                id: getString(row[itemIdx]),
                group: parentIdx >= 0 ? getString(row[parentIdx]) : "",
                owner: legendValue,
                name: itemNameIdx >= 0 ? getString(row[itemNameIdx]) : getString(row[itemIdx]),
                start: getDate(row[startIdx]),
                end: getDate(row[endIdx]),
                progress: progressIdx >= 0 ? getNumber(row[progressIdx]) : 0,
                color: legendValue ? legendColorMap[legendValue] : "#0078d4",
                legendValue: legendValue,
                label: labelIdx >= 0 ? getString(row[labelIdx]) : "",
                identity: identities ? identities[i] : undefined // Attach the real identity object
            };
            additionalColumns.forEach(col => {
                task[col.key] = row[col.idx];
            });
            return task;
        });
        console.log("Sample identity from dataView:", identities?.[0]);
        console.log("Sample task with identity:", tasks[0]);

        // Read legend formatting settings
        const legendPosition = this.formattingSettings.legendCard?.position?.value?.value || "top";
        const legendFontSize = this.formattingSettings.legendCard?.fontSize?.value || 14;

        this.root.render(
            <GanttChart
                width={options.viewport.width}
                height={options.viewport.height}
                tasks={tasks}
                additionalColumns={additionalColumns}
                labelDisplayName={labelDisplayName}
                labelParentName={labelParentName}
                legendPosition={legendPosition as 'top' | 'bottom' | 'left' | 'right'}
                legendFontSize={legendFontSize}
                selectionManager={this.selectionManager}
                host={this.host}
            />
        );
    }

    /**
     * Returns properties pane formatting model content hierarchies, properties and latest formatting values, Then populate properties pane.
     * This method is called once every time we open properties pane or when the user edit any format property. 
     */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    public destroy() {
        this.root.unmount();
    }
}