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
import ISelectionIdBuilder = powerbi.extensibility.ISelectionIdBuilder;

import { VisualFormattingSettingsModel } from "./settings";
//dataviewcolumn
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;

export class Visual implements IVisual {
    private root: ReactDOM.Root;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private selectionManager: ISelectionManager;
    private host: VisualHost;
    private selectedIds: any[] = [];

    constructor(options: VisualConstructorOptions) {
        this.formattingSettingsService = new FormattingSettingsService();
        this.root = ReactDOM.createRoot(options.element);
        this.host = options.host as VisualHost;
        this.selectionManager = this.host.createSelectionManager();
        // Listen for selection changes if possible
        if (this.selectionManager['registerOnSelectCallback']) {
            this.selectionManager['registerOnSelectCallback']((ids: any[]) => {
                this.selectedIds = ids;
                this.renderGanttChart();
            });
        }
    }

    public update(options: VisualUpdateOptions) {
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            options.dataViews[0]
        );

        const dataView = options.dataViews[0];
        const categorical = dataView.categorical;
        if (!categorical) {
            // No data, render empty
            this.root.render(<div>No data</div>);
            return;
        }

        // Map roles to category/value columns
        const categoryColumns = categorical.categories || [];
        const valueColumns = categorical.values || { forEach: () => {}, length: 0 };

        // Helper to get category column by role
        const getCategory = (role: string) => categoryColumns.find(col => col.source.roles && col.source.roles[role]);
        // Helper to get value column by role
        const getValue = (role: string) => {
            if (!categorical.values) return undefined;
            return categorical.values.find(col => col.source.roles && col.source.roles[role]);
        };

        const itemCol = getCategory("item");
        const parentCol = getCategory("parent");
        const itemNameCol = getCategory("itemName");
        const startCol = getCategory("startDate");
        const endCol = getCategory("endDate");
        const legendCol = getCategory("legend");
        const legendValueCol = getCategory("legendValue");
        const progressCol = getValue("progress");
        const labelCol = getValue("label");

        // Helper to check if valueColumns is an array
        const isArray = Array.isArray(valueColumns);
        const seen = new Set();
        const additionalColumns = categoryColumns
            .filter(col => col.source.roles && col.source.roles["additionalColumns"])
            .filter(col => {
                if (seen.has(col.source.queryName)) return false;
                seen.add(col.source.queryName);
                return true;
            })
            .map(col => ({
                key: col.source.queryName,
                displayName: col.source.displayName,
                idx: col.source.index,
                format: col.source.format
            }));

        const labelDisplayName = labelCol ? labelCol.source.displayName : "Label";
        const labelParentName = parentCol ? parentCol.source.displayName : "Parent";
        const labelItemName = itemNameCol ? itemNameCol.source.displayName : "Item";

        // Assign a color for each legend value (simple hash for demo)
        const colorPalette = [
            "#0078d4", "#e3008c", "#ffaa44", "#00b7c3", "#bad80a", "#b146c2", "#ff8c00", "#a80000"
        ];
        const legendColorMap: Record<string, string> = {};
        let colorIdx = 0;

        const rowCount = itemCol ? itemCol.values.length : 0;
        const tasks: Task[] = [];
        for (let i = 0; i < rowCount; i++) {
            const legendValue = legendCol ? String(legendCol.values[i]) : "";
            if (legendValue && !legendColorMap[legendValue]) {
                legendColorMap[legendValue] = colorPalette[colorIdx % colorPalette.length];
                colorIdx++;
            }
            const selectionBuilder: ISelectionIdBuilder = this.host
            .createSelectionIdBuilder()
            .withCategory(dataView.categorical.categories[0], i);
            // Safely parse start and end as Date only if string or number
            let startVal = startCol ? startCol.values[i] : null;
            let endVal = endCol ? endCol.values[i] : null;
            const start = (typeof startVal === 'string' || typeof startVal === 'number') ? new Date(startVal) : null;
            const end = (typeof endVal === 'string' || typeof endVal === 'number') ? new Date(endVal) : null;
            const task: Task = {
                id: itemCol ? String(itemCol.values[i]) : String(i),
                group: parentCol ? String(parentCol.values[i]) : "",
                owner: legendValue,
                name: itemNameCol ? String(itemNameCol.values[i]) : (itemCol ? String(itemCol.values[i]) : String(i)),
                start,
                end,
                progress: progressCol ? Number(progressCol.values[i]) : 0,
                color: legendValue ? legendColorMap[legendValue] : "#0078d4",
                legendValue: legendValueCol ? String(legendValueCol.values[i]) : legendValue,
                label: labelCol ? String(labelCol.values[i]) : "",
                identity: selectionBuilder.createSelectionId(),
            };

            additionalColumns.forEach(col => {
                const catCol = categoryColumns.find(c => c.source.queryName === col.key);
                if (catCol) {
                    task[col.key] = catCol.values[i];
                }
            });
            tasks.push(task);
        }

        // Read legend formatting settings
        const legendPosition = this.formattingSettings.legendCard?.position?.value?.value || "top";
        const legendFontSize = this.formattingSettings.legendCard?.fontSize?.value || 14;

        console.log("additionalColumns", additionalColumns);

        this.renderGanttChart({
            width: options.viewport.width,
            height: options.viewport.height,
            tasks,
            additionalColumns,
            labelDisplayName,
            labelParentName,
            labelItemName,
            legendPosition: legendPosition as 'top' | 'bottom' | 'left' | 'right',
            legendFontSize,
            selectionManager: this.selectionManager,
            host: this.host,
            selectedIds: this.selectedIds
        });
    }

    private renderGanttChart(propsOverride?: any) {
        // Use the last known props or override
        this.root.render(
            <GanttChart
                {...(propsOverride || {})}
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