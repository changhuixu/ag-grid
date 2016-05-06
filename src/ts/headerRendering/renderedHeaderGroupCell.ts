import {Utils as _} from "../utils";
import {SvgFactory} from "../svgFactory";
import {ColumnGroup} from "../entities/columnGroup";
import {ColumnController} from "../columnController/columnController";
import {FilterManager} from "../filter/filterManager";
import {GridOptionsWrapper} from "../gridOptionsWrapper";
import {Column} from "../entities/column";
import {HorizontalDragService} from "./horizontalDragService";
import {Autowired, PostConstruct} from "../context/context";
import {CssClassApplier} from "./cssClassApplier";
import {IRenderedHeaderElement} from "./iRenderedHeaderElement";
import {DragSource, DropTarget, DragAndDropService} from "../dragAndDrop/dragAndDropService";

var svgFactory = SvgFactory.getInstance();

export class RenderedHeaderGroupCell implements IRenderedHeaderElement {

    @Autowired('filterManager') private filterManager: FilterManager;
    @Autowired('gridOptionsWrapper') private gridOptionsWrapper: GridOptionsWrapper;
    @Autowired('horizontalDragService') private dragService: HorizontalDragService;
    @Autowired('columnController') private columnController: ColumnController;
    @Autowired('dragAndDropService') private dragAndDropService: DragAndDropService;

    private eHeaderGroupCell: HTMLElement;
    private eHeaderCellResize: HTMLElement;
    private columnGroup: ColumnGroup;
    private dragSourceDropTarget: DropTarget;

    private groupWidthStart: number;
    private childrenWidthStarts: number[];
    private parentScope: any;
    private destroyFunctions: (()=>void)[] = [];

    private eRoot: HTMLElement;

    constructor(columnGroup: ColumnGroup, eRoot: HTMLElement, parentScope: any, dragSourceDropTarget: DropTarget) {
        this.columnGroup = columnGroup;
        this.parentScope = parentScope;
        this.eRoot = eRoot;
        this.parentScope = parentScope;
        this.dragSourceDropTarget = dragSourceDropTarget;
    }

    public getGui(): HTMLElement {
        return this.eHeaderGroupCell;
    }

    public onIndividualColumnResized(column: Column) {
        if (this.columnGroup.isChildInThisGroupDeepSearch(column)) {
            this.setWidth();
        }
    }

    @PostConstruct
    public init(): void {

        this.eHeaderGroupCell = document.createElement('div');

        CssClassApplier.addHeaderClassesFromCollDef(this.columnGroup.getColGroupDef(), this.eHeaderGroupCell, this.gridOptionsWrapper);

        this.setupResize();
        this.addClasses();
        this.setupLabel();
        // this.setupMove();
        this.setWidth();
    }

    private setupLabel(): void {
        // no renderer, default text render
        var groupName = this.columnGroup.getHeaderName();
        if (groupName && groupName !== '') {
            var eGroupCellLabel = document.createElement("div");
            eGroupCellLabel.className = 'ag-header-group-cell-label';
            this.eHeaderGroupCell.appendChild(eGroupCellLabel);

            if (_.isBrowserSafari()) {
                eGroupCellLabel.style.display = 'table-cell';
            }

            var eInnerText = document.createElement("span");
            eInnerText.className = 'ag-header-group-text';
            eInnerText.innerHTML = groupName;
            eGroupCellLabel.appendChild(eInnerText);

            if (this.columnGroup.isExpandable()) {
                this.addGroupExpandIcon(eGroupCellLabel);
            }
        }
    }

    private addClasses(): void {
        _.addCssClass(this.eHeaderGroupCell, 'ag-header-group-cell');
        // having different classes below allows the style to not have a bottom border
        // on the group header, if no group is specified
        if (this.columnGroup.getColGroupDef()) {
            _.addCssClass(this.eHeaderGroupCell, 'ag-header-group-cell-with-group');
        } else {
            _.addCssClass(this.eHeaderGroupCell, 'ag-header-group-cell-no-group');
        }
    }

    private setupResize(): void {
        if (!this.gridOptionsWrapper.isEnableColResize()) { return; }

        this.eHeaderCellResize = document.createElement("div");
        this.eHeaderCellResize.className = "ag-header-cell-resize";
        this.eHeaderGroupCell.appendChild(this.eHeaderCellResize);
        this.dragService.addDragHandling({
            eDraggableElement: this.eHeaderCellResize,
            eBody: this.eRoot,
            cursor: 'col-resize',
            startAfterPixels: 0,
            onDragStart: this.onDragStart.bind(this),
            onDragging: this.onDragging.bind(this)
        });

        if (!this.gridOptionsWrapper.isSuppressAutoSize()) {
            this.eHeaderCellResize.addEventListener('dblclick', (event:MouseEvent) => {
                // get list of all the column keys we are responsible for
                var keys: string[] = [];
                this.columnGroup.getDisplayedLeafColumns().forEach( (column: Column)=>{
                    // not all cols in the group may be participating with auto-resize
                    if (!column.getColDef().suppressAutoSize) {
                        keys.push(column.getColId());
                    }
                });
                if (keys.length>0) {
                    this.columnController.autoSizeColumns(keys);
                }
            });
        }
    }

    private setupMove(): void {
        var eLabel = <HTMLElement> this.eHeaderGroupCell.querySelector('.ag-header-group-cell-label');
        if (!eLabel) { return; }
    
        if (this.gridOptionsWrapper.isSuppressMovableColumns()) { return; }
    
        // if any child is fixed, then don't allow moving
        var atLeastOneChildNotMovable = false;
        this.columnGroup.getLeafColumns().forEach( (column: Column) => {
            if (column.getColDef().suppressMovable) {
                atLeastOneChildNotMovable = true;
            }
        });
        if (atLeastOneChildNotMovable) { return; }
    
        // don't allow moving of headers when forPrint, as the header overlay doesn't exist
        if (this.gridOptionsWrapper.isForPrint()) { return; }
    
        if (eLabel) {
            var dragSource: DragSource = {
                eElement: eLabel,
                dragItem: this.columnGroup,
                dragSourceDropTarget: this.dragSourceDropTarget
            };
            this.dragAndDropService.addDragSource(dragSource);
        }
    }

    private setWidth(): void {
        var widthChangedListener = () => {
            this.eHeaderGroupCell.style.width = this.columnGroup.getActualWidth() + 'px';
        };

        this.columnGroup.getLeafColumns().forEach( column => {
            column.addEventListener(Column.EVENT_WIDTH_CHANGED, widthChangedListener);
            this.destroyFunctions.push( () => {
                column.removeEventListener(Column.EVENT_WIDTH_CHANGED, widthChangedListener);
            });
        });

        widthChangedListener();
    }

    public destroy(): void {
        this.destroyFunctions.forEach( (func)=> {
            func();
        });
    }

    private addGroupExpandIcon(eGroupCellLabel: HTMLElement) {
        var eGroupIcon: any;
        if (this.columnGroup.isExpanded()) {
            eGroupIcon = _.createIcon('columnGroupOpened', this.gridOptionsWrapper, null, svgFactory.createArrowLeftSvg);
        } else {
            eGroupIcon = _.createIcon('columnGroupClosed', this.gridOptionsWrapper, null, svgFactory.createArrowRightSvg);
        }
        eGroupIcon.className = 'ag-header-expand-icon';
        eGroupCellLabel.appendChild(eGroupIcon);

        var that = this;
        eGroupIcon.onclick = function() {
            var newExpandedValue = !that.columnGroup.isExpanded();
            that.columnController.setColumnGroupOpened(that.columnGroup, newExpandedValue);
        };
    }

    public onDragStart(): void {
        this.groupWidthStart = this.columnGroup.getActualWidth();
        this.childrenWidthStarts = [];
        this.columnGroup.getDisplayedLeafColumns().forEach( (column: Column) => {
            this.childrenWidthStarts.push(column.getActualWidth());
        });
    }

    public onDragging(dragChange: any, finished: boolean): void {

        var newWidth = this.groupWidthStart + dragChange;
        var minWidth = this.columnGroup.getMinWidth();
        if (newWidth < minWidth) {
            newWidth = minWidth;
        }

        // distribute the new width to the child headers
        var changeRatio = newWidth / this.groupWidthStart;
        // keep track of pixels used, and last column gets the remaining,
        // to cater for rounding errors, and min width adjustments
        var pixelsToDistribute = newWidth;
        var displayedColumns = this.columnGroup.getDisplayedLeafColumns();
        displayedColumns.forEach( (column: Column, index: any) => {
            var notLastCol = index !== (displayedColumns.length - 1);
            var newChildSize: any;
            if (notLastCol) {
                // if not the last col, calculate the column width as normal
                var startChildSize = this.childrenWidthStarts[index];
                newChildSize = startChildSize * changeRatio;
                if (newChildSize < column.getMinWidth()) {
                    newChildSize = column.getMinWidth();
                }
                pixelsToDistribute -= newChildSize;
            } else {
                // if last col, give it the remaining pixels
                newChildSize = pixelsToDistribute;
            }
            this.columnController.setColumnWidth(column, newChildSize, finished);
        });
    }

}
