// Global Application State
let appState = {
    allData: [],
    filteredData: [],
    columns: [], // Dynamically loaded column list
    currentPage: 1,
    pageSize: 50,
    filters: {}, // Dynamically loaded column filters
    isPolling: false,
    pollIntervalId: null,
    currentExplorerPath: "",
    activeTab: "server"
};

// Global Chart.js Instances
let charts = {
    topDtc: null,
    topModules: null,
    statusModules: null,
    programDist: null
};

// DOM Elements Cache
const elements = {
    dbStatus: document.getElementById('db-status'),
    folderPathInput: document.getElementById('folder-path-input'),
    btnBrowseFolder: document.getElementById('btn-browse-folder'),
    folderPickerClient: document.getElementById('folder-picker-client'),
    btnRunAnalysis: document.getElementById('btn-run-analysis'),
    btnResetDb: document.getElementById('btn-reset-db'),
    
    logConsoleContainer: document.getElementById('log-console-container'),
    logConsole: document.getElementById('log-console'),
    consoleSpinner: document.getElementById('console-spinner'),
    btnToggleLogs: document.getElementById('btn-toggle-logs'),
    
    resultsSection: document.getElementById('results-section'),
    
    // KPIs
    kpiTotalRecords: document.getElementById('kpi-total-records'),
    kpiUniqueDtcs: document.getElementById('kpi-unique-dtcs'),
    kpiActivePrograms: document.getElementById('kpi-active-programs'),
    kpiOpenIssues: document.getElementById('kpi-open-issues'),
    
    // Table Header Row for Dynamic Headers
    tableHeadersRow: document.getElementById('table-headers-row'),
    btnClearFilters: document.getElementById('btn-clear-filters'),
    btnExportExcel: document.getElementById('btn-export-excel'),
    
    // Grid Table Body & Controls
    registryTableBody: document.getElementById('registry-table-body'),
    pageSizeSelect: document.getElementById('page-size-select'),
    paginationInfoText: document.getElementById('pagination-info-text'),
    btnPagePrev: document.getElementById('btn-page-prev'),
    pageNumDisplay: document.getElementById('page-num-display'),
    btnPageNext: document.getElementById('btn-page-next'),
    
    // Modal Explorer Tabs
    explorerModal: document.getElementById('explorer-modal'),
    explorerClose: document.getElementById('explorer-close'),
    tabServer: document.getElementById('tab-server'),
    tabClient: document.getElementById('tab-client'),
    explorerServerView: document.getElementById('explorer-server-view'),
    explorerClientView: document.getElementById('explorer-client-view'),
    
    // Explorer Server-side Elements
    explorerCurrentPath: document.getElementById('explorer-current-path'),
    explorerNavUp: document.getElementById('explorer-nav-up'),
    explorerNavHome: document.getElementById('explorer-nav-home'),
    explorerShortcutWorkspace: document.getElementById('explorer-shortcut-workspace'),
    explorerShortcutRoot: document.getElementById('explorer-shortcut-root'),
    explorerShortcutUser: document.getElementById('explorer-shortcut-user'),
    explorerItemsContainer: document.getElementById('explorer-items-container'),
    
    // Explorer Client-side Upload
    uploadDropzone: document.getElementById('upload-dropzone'),
    selectedClientFilesCount: document.getElementById('selected-client-files-count'),
    
    // Explorer Modal Controls
    explorerSelectedInfo: document.getElementById('explorer-selected-info'),
    explorerBtnCancel: document.getElementById('explorer-btn-cancel'),
    explorerBtnSelect: document.getElementById('explorer-btn-select'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message')
};

// Initialize App on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupEventListeners();
    setupErrorLogging();
    checkEngineStatus();
    loadRegistryData();
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (appState.allData.length > 0) {
            renderCharts();
        }
    });
}

// ----------------------------------------------------
// Event Listeners Configuration
// ----------------------------------------------------
function setupEventListeners() {
    // Ingestion controls
    elements.folderPathInput.addEventListener('input', handleFolderPathChange);
    elements.folderPickerClient.addEventListener('change', handleClientFolderSelected);
    elements.btnRunAnalysis.addEventListener('click', startAnalysis);
    elements.btnResetDb.addEventListener('click', resetParserEngine);
    elements.btnToggleLogs.addEventListener('click', toggleLogsMinimization);
    
    // Clear Filters Action
    elements.btnClearFilters.addEventListener('click', clearAllFilters);
    
    // Event delegation for dynamic header column filters
    elements.tableHeadersRow.addEventListener('change', (e) => {
        if (e.target.classList.contains('header-filter-select')) {
            handleFilterChange();
        }
    });
    elements.tableHeadersRow.addEventListener('input', debounce((e) => {
        if (e.target.classList.contains('header-filter-input')) {
            handleFilterChange();
        }
    }, 250));
    
    // Pagination & Page Size
    elements.pageSizeSelect.addEventListener('change', (e) => {
        appState.pageSize = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
        appState.currentPage = 1;
        renderGridAndPagination();
    });
    elements.btnPagePrev.addEventListener('click', () => {
        if (appState.currentPage > 1) {
            appState.currentPage--;
            renderGridAndPagination();
        }
    });
    elements.btnPageNext.addEventListener('click', () => {
        const totalPages = getTotalPages();
        if (appState.currentPage < totalPages) {
            appState.currentPage++;
            renderGridAndPagination();
        }
    });
    
    // Export to Excel
    elements.btnExportExcel.addEventListener('click', exportToExcel);
    
    // Modal Dialog Show / Hide triggers
    elements.btnBrowseFolder.addEventListener('click', openExplorerModal);
    elements.explorerClose.addEventListener('click', closeExplorerModal);
    elements.explorerBtnCancel.addEventListener('click', closeExplorerModal);
    elements.explorerBtnSelect.addEventListener('click', selectExplorerFolder);
    
    // Dialog Navigation Tab Selectors
    elements.tabServer.addEventListener('click', () => toggleModalTab('server'));
    elements.tabClient.addEventListener('click', () => toggleModalTab('client'));
    
    // Server Directory navigation click triggers
    elements.explorerNavUp.addEventListener('click', explorerNavigateUp);
    elements.explorerNavHome.addEventListener('click', () => fetchDirectoryContents(""));
    elements.explorerShortcutWorkspace.addEventListener('click', () => fetchDirectoryContents(""));
    elements.explorerShortcutRoot.addEventListener('click', () => fetchDirectoryContents("C:\\"));
    elements.explorerShortcutUser.addEventListener('click', () => fetchDirectoryContents("USER_HOME"));
    
    // Click triggers for Client Drag/Drop
    elements.uploadDropzone.addEventListener('click', () => {
        elements.folderPickerClient.click();
    });
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        elements.uploadDropzone.addEventListener(eventName, preventDefaults, false);
    });
    
    elements.uploadDropzone.addEventListener('drop', handleClientFolderDrop, false);
}

// ----------------------------------------------------
// Folder Selection & Action Ingest Buttons
// ----------------------------------------------------
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleFolderPathChange() {
    const val = elements.folderPathInput.value.trim();
    if (val.length > 0) {
        elements.btnRunAnalysis.disabled = false;
    } else {
        elements.btnRunAnalysis.disabled = true;
    }
}

function handleClientFolderSelected(e) {
    if (e.target.files.length > 0) {
        const sampleFile = e.target.files[0];
        const relativePath = sampleFile.webkitRelativePath;
        if (relativePath) {
            const folderName = relativePath.split('/')[0];
            const workspacePath = `C:\\DiagIngestTemp\\${folderName}`;
            
            elements.folderPathInput.value = workspacePath;
            handleFolderPathChange();
            
            elements.selectedClientFilesCount.innerText = `Selected Local Folder: "${folderName}" (${e.target.files.length} log files)`;
            elements.explorerSelectedInfo.innerHTML = `Folder (Client Upload): <b class="text-primary">${folderName}</b>`;
            elements.explorerBtnSelect.dataset.selectedPath = workspacePath;
            elements.explorerBtnSelect.dataset.folderSource = "client";
            
            showToast(`Ingested local client files list successfully.`);
        }
    }
}

function handleClientFolderDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        const sampleFile = files[0];
        const folderName = sampleFile.name || "DroppedFolder";
        const workspacePath = `C:\\DiagIngestTemp\\${folderName}`;
        
        elements.folderPathInput.value = workspacePath;
        handleFolderPathChange();
        
        elements.selectedClientFilesCount.innerText = `Dropped Folder: "${folderName}" (${files.length} files detected)`;
        elements.explorerSelectedInfo.innerHTML = `Folder (Dropped Ingest): <b class="text-primary">${folderName}</b>`;
        elements.explorerBtnSelect.dataset.selectedPath = workspacePath;
        elements.explorerBtnSelect.dataset.folderSource = "client";
    }
}

// ----------------------------------------------------
// Explorer Modal Tab Control & Browse Logic
// ----------------------------------------------------
function openExplorerModal() {
    elements.explorerModal.classList.remove('hidden');
    toggleModalTab(appState.activeTab);
}

function closeExplorerModal() {
    elements.explorerModal.classList.add('hidden');
}

function toggleModalTab(tabType) {
    appState.activeTab = tabType;
    if (tabType === 'server') {
        elements.tabServer.classList.add('active');
        elements.tabClient.classList.remove('active');
        elements.explorerServerView.classList.remove('hidden');
        elements.explorerClientView.classList.add('hidden');
        
        fetchDirectoryContents(appState.currentExplorerPath);
    } else {
        elements.tabServer.classList.remove('active');
        elements.tabClient.classList.add('active');
        elements.explorerServerView.classList.add('hidden');
        elements.explorerClientView.classList.remove('hidden');
        
        elements.explorerSelectedInfo.innerHTML = "Upload a local client directory tree.";
        elements.explorerBtnSelect.dataset.folderSource = "client";
    }
}

function fetchDirectoryContents(targetPath) {
    let url = '/api/browse';
    if (targetPath) {
        url += `?path=${encodeURIComponent(targetPath)}`;
    }
    
    fetch(url)
        .then(async res => {
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const detail = errData.detail || `HTTP error ${res.status}`;
                throw new Error(detail);
            }
            return res.json();
        })
        .then(data => {
            appState.currentExplorerPath = data.current_path;
            elements.explorerCurrentPath.innerText = data.current_path;
            
            elements.explorerNavUp.disabled = !data.parent_path;
            elements.explorerNavUp.dataset.parent = data.parent_path || "";
            
            elements.explorerItemsContainer.innerHTML = "";
            
            if (data.subdirs && data.subdirs.length > 0) {
                data.subdirs.forEach(dir => {
                    const div = document.createElement('div');
                    div.className = "explorer-item";
                    div.innerHTML = `📁 ${dir}`;
                    div.addEventListener('click', () => {
                        document.querySelectorAll('.explorer-item').forEach(el => el.classList.remove('active'));
                        div.classList.add('active');
                        
                        const fullPath = getJoinedPath(appState.currentExplorerPath, dir);
                        elements.explorerSelectedInfo.innerHTML = `Folder: <b class="text-primary">${dir}</b>`;
                        elements.explorerBtnSelect.dataset.selectedPath = fullPath;
                        elements.explorerBtnSelect.dataset.folderSource = "server";
                    });
                    
                    div.addEventListener('dblclick', () => {
                        const fullPath = getJoinedPath(appState.currentExplorerPath, dir);
                        fetchDirectoryContents(fullPath);
                    });
                    
                    elements.explorerItemsContainer.appendChild(div);
                });
            } else {
                elements.explorerItemsContainer.innerHTML = `
                    <div style="grid-column: span 2; text-align: center; color: var(--text-muted); font-size: 0.72rem; padding: 20px;">
                        This directory contains no subfolders.
                    </div>
                `;
            }
            
            elements.explorerSelectedInfo.innerHTML = `Folder: <b>${getFolderName(data.current_path)}</b>`;
            elements.explorerBtnSelect.dataset.selectedPath = data.current_path;
            elements.explorerBtnSelect.dataset.folderSource = "server";
        })
        .catch(err => {
            logErrorToConsole("Browse Server Directories", err);
            showToast("Failed to browse server directories.", "error");
        });
}

function explorerNavigateUp() {
    const parentPath = elements.explorerNavUp.dataset.parent;
    if (parentPath) {
        fetchDirectoryContents(parentPath);
    }
}

function selectExplorerFolder() {
    const targetPath = elements.explorerBtnSelect.dataset.selectedPath;
    if (targetPath) {
        elements.folderPathInput.value = targetPath;
        handleFolderPathChange();
        closeExplorerModal();
        showToast("Folder selected: " + getFolderName(targetPath));
    }
}

// ----------------------------------------------------
// Log Viewer Controls (Minimization Options)
// ----------------------------------------------------
function toggleLogsMinimization() {
    const container = elements.logConsoleContainer;
    const btn = elements.btnToggleLogs;
    
    if (container.classList.contains('minimized')) {
        container.classList.remove('minimized');
        btn.innerText = "➖";
        btn.title = "Minimize logs";
    } else {
        container.classList.add('minimized');
        btn.innerText = "➕";
        btn.title = "Maximize logs";
    }
}

function checkEngineStatus() {
    fetch('/api/status')
        .then(async res => {
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const detail = errData.detail || `HTTP error ${res.status}`;
                throw new Error(detail);
            }
            return res.json();
        })
        .then(status => {
            if (status.is_processing) {
                elements.folderPathInput.value = status.current_folder || "";
                handleFolderPathChange();
                elements.logConsoleContainer.classList.remove('hidden');
                elements.consoleSpinner.classList.remove('hidden');
                startPollingLogs();
            } else if (status.processing_complete) {
                elements.logConsoleContainer.classList.remove('hidden');
                elements.consoleSpinner.classList.add('hidden');
                updateLogConsole(status.logs);
            }
        })
        .catch(err => logErrorToConsole("Check Engine Status", err));
}

function loadRegistryData() {
    fetch('/api/data')
        .then(async res => {
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const detail = errData.detail || `HTTP error ${res.status}`;
                throw new Error(detail);
            }
            return res.json();
        })
        .then(result => {
            appState.allData = result.data || [];
            if (appState.allData.length > 0) {
                elements.resultsSection.classList.remove('hidden');
                
                // Identify and initialize dynamic columns
                buildDynamicColumns();
                buildHeaderFiltersMarkup();
                applyFilters();
            } else {
                elements.resultsSection.classList.add('hidden');
            }
        })
        .catch(err => logErrorToConsole("Load Diagnostics Data", err));
}

function startAnalysis() {
    const folderPath = elements.folderPathInput.value.trim();
    if (!folderPath) return;
    
    elements.logConsoleContainer.classList.remove('hidden');
    elements.logConsoleContainer.classList.remove('minimized');
    elements.btnToggleLogs.innerText = "➖";
    
    elements.logConsole.innerHTML = `<div class="log-line system-msg">[SYSTEM] Connecting to backend engine for parsing '${folderPath}'...</div>`;
    elements.consoleSpinner.classList.remove('hidden');
    elements.btnRunAnalysis.disabled = true;
    
    fetch('/api/start-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_path: folderPath })
    })
    .then(async res => {
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const detail = errData.detail || `HTTP error ${res.status}`;
            throw new Error(detail);
        }
        return res.json();
    })
    .then(data => {
        if (data.status === 'started' || data.status === 'already_processing') {
            startPollingLogs();
        } else {
            elements.consoleSpinner.classList.add('hidden');
            elements.btnRunAnalysis.disabled = false;
            appendLogLine({ message: "Failed to initiate parsing engine.", level: "error", time: "" });
        }
    })
    .catch(err => {
        elements.consoleSpinner.classList.add('hidden');
        elements.btnRunAnalysis.disabled = false;
        logErrorToConsole("Start Analysis Engine", err);
    });
}

function startPollingLogs() {
    if (appState.isPolling) return;
    appState.isPolling = true;
    
    appState.pollIntervalId = setInterval(() => {
        fetch('/api/status')
            .then(async res => {
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    const detail = errData.detail || `HTTP error ${res.status}`;
                    throw new Error(detail);
                }
                return res.json();
            })
            .then(status => {
                updateLogConsole(status.logs);
                
                if (!status.is_processing) {
                    clearInterval(appState.pollIntervalId);
                    appState.isPolling = false;
                    elements.consoleSpinner.classList.add('hidden');
                    elements.btnRunAnalysis.disabled = false;
                    
                    if (status.error_message) {
                        showToast(`Analysis error: ${status.error_message}`, "error");
                        logErrorToConsole("Analysis Engine Parsing", new Error(status.error_message));
                    } else if (status.processing_complete) {
                        showToast("Diagnostic analysis complete! Data grid sync successful.");
                        loadRegistryData();
                    }
                }
            })
            .catch(err => {
                logErrorToConsole("Poll Logs Progress", err);
                clearInterval(appState.pollIntervalId);
                appState.isPolling = false;
                elements.consoleSpinner.classList.add('hidden');
                elements.btnRunAnalysis.disabled = false;
            });
    }, 800);
}

function updateLogConsole(logs) {
    if (!logs || logs.length === 0) return;
    elements.logConsole.innerHTML = "";
    logs.forEach(log => {
        appendLogLine(log);
    });
}

function appendLogLine(log) {
    const div = document.createElement('div');
    div.className = `log-line ${log.level || 'info'}`;
    const timeStr = log.time ? `[${log.time}] ` : '';
    div.innerText = `${timeStr}${log.message}`;
    elements.logConsole.appendChild(div);
    elements.logConsole.scrollTop = elements.logConsole.scrollHeight;
}

function resetParserEngine() {
    if (confirm("Are you sure you want to reset the current parser tracking state?")) {
        fetch('/api/reset', { method: 'POST' })
            .then(async res => {
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    const detail = errData.detail || `HTTP error ${res.status}`;
                    throw new Error(detail);
                }
                return res.json();
            })
            .then(() => {
                if (appState.pollIntervalId) {
                    clearInterval(appState.pollIntervalId);
                    appState.isPolling = false;
                }
                elements.logConsoleContainer.classList.add('hidden');
                elements.consoleSpinner.classList.add('hidden');
                elements.logConsole.innerHTML = "";
                elements.folderPathInput.value = "";
                elements.btnRunAnalysis.disabled = true;
                
                elements.selectedClientFilesCount.innerText = "No local folder selected.";
                showToast("Parser state reset successfully.");
            })
            .catch(err => logErrorToConsole("Reset Parser Engine", err));
    }
}

// ----------------------------------------------------
// Dynamic Columns & Column-header Filters Builder
// ----------------------------------------------------
function buildDynamicColumns() {
    if (appState.allData.length === 0) return;
    
    // Core columns listed in visual priority order
    const coreColumns = ["File", "Module", "Code", "Description", "Issue Status", "Comments", "Author", "Program name", "VIN Number"];
    
    // Get all column keys from dataset
    const allKeys = Object.keys(appState.allData[0] || {});
    
    const columns = [];
    
    // 1. Add core columns that exist in dataset
    coreColumns.forEach(col => {
        if (allKeys.includes(col)) {
            columns.push(col);
        }
    });
    
    // 2. Add any other "unknown/new" columns at the end, except index and Last Updated
    allKeys.forEach(key => {
        if (key !== "index" && key !== "Last Updated" && !columns.includes(key)) {
            columns.push(key);
        }
    });
    
    // 3. Make sure Last Updated is placed as the final column if it exists
    if (allKeys.includes("Last Updated")) {
        columns.push("Last Updated");
    }
    
    appState.columns = columns;
    
    // Re-initialize filters schema for all columns
    appState.filters = {};
    columns.forEach(col => {
        appState.filters[col] = "";
    });
}

function getUniqueValuesCount(colName) {
    return new Set(appState.allData.map(item => item[colName]).filter(Boolean)).size;
}

function buildHeaderFiltersMarkup() {
    elements.tableHeadersRow.innerHTML = "";
    
    appState.columns.forEach(col => {
        const th = document.createElement('th');
        
        // Mark editable header visually
        const isEditable = (col === "Comments" || col === "Issue Status" || col === "Author");
        if (isEditable) {
            th.className = "editable-hdr";
        }
        
        const titleText = isEditable ? `${col} ✏️` : col;
        
        // Determine filter type dynamically
        let filterControl = "";
        
        if (col === "Last Updated") {
            filterControl = `<div class="header-filter-dummy"></div>`;
        } else {
            const uniqueCount = getUniqueValuesCount(col);
            
            // Hardcode comments and description to text input, or columns with high cardinality
            const isTextField = (col === "Description" || col === "Comments" || uniqueCount > 50);
            
            if (isTextField) {
                filterControl = `<input type="text" data-col="${col}" class="header-filter-input" placeholder="Search..." />`;
            } else {
                // Generate sorted unique values for select options
                const uniqueVals = [...new Set(appState.allData.map(item => item[col]).filter(Boolean))].sort();
                
                let options = `<option value="">All</option>`;
                uniqueVals.forEach(val => {
                    options += `<option value="${val}">${val}</option>`;
                });
                
                filterControl = `<select data-col="${col}" class="header-filter-select">${options}</select>`;
            }
        }
        
        th.innerHTML = `
            <div class="header-cell-title">${titleText}</div>
            ${filterControl}
        `;
        
        elements.tableHeadersRow.appendChild(th);
    });
}

function handleFilterChange() {
    // Collect active values from all dynamic header filter controls
    appState.columns.forEach(col => {
        if (col === "Last Updated") return;
        
        const control = elements.tableHeadersRow.querySelector(`[data-col="${col}"]`);
        if (control) {
            appState.filters[col] = control.value;
        }
    });
    
    appState.currentPage = 1;
    applyFilters();
}

function applyFilters() {
    appState.filteredData = appState.allData.filter(row => {
        for (const col of appState.columns) {
            if (col === "Last Updated") continue;
            
            const filterVal = appState.filters[col];
            if (!filterVal) continue;
            
            const cellVal = (row[col] !== undefined && row[col] !== null) ? String(row[col]) : "";
            
            const uniqueCount = getUniqueValuesCount(col);
            const isTextField = (col === "Description" || col === "Comments" || uniqueCount > 50);
            
            if (isTextField) {
                // Substring search case-insensitive
                if (!cellVal.toLowerCase().includes(filterVal.toLowerCase().trim())) {
                    return false;
                }
            } else {
                // Strict category selection match
                if (cellVal !== filterVal) {
                    return false;
                }
            }
        }
        return true;
    });
    
    updateKPIs();
    renderGridAndPagination();
    renderCharts();
}

function clearAllFilters() {
    appState.columns.forEach(col => {
        if (col === "Last Updated") return;
        
        const control = elements.tableHeadersRow.querySelector(`[data-col="${col}"]`);
        if (control) {
            control.value = "";
        }
        appState.filters[col] = "";
    });
    
    appState.currentPage = 1;
    applyFilters();
    showToast("Filters cleared.");
}

// ----------------------------------------------------
// UI Render Methods (KPIs, Grid, Pagination)
// ----------------------------------------------------
function updateKPIs() {
    const total = appState.filteredData.length;
    const uniqueDtcs = new Set(appState.filteredData.map(r => r.Code).filter(Boolean)).size;
    
    // Find active programs / open issues safely in case key names change slightly
    const programColName = appState.columns.find(c => c.toLowerCase().includes("program")) || "Program name";
    const statusColName = appState.columns.find(c => c.toLowerCase().includes("status")) || "Issue Status";
    
    const activeProgs = new Set(appState.filteredData.map(r => r[programColName]).filter(Boolean)).size;
    const openIssues = appState.filteredData.filter(r => {
        const val = String(r[statusColName] || '').toLowerCase();
        return val === 'open' || val === 'new';
    }).length;
    
    elements.kpiTotalRecords.innerText = total.toLocaleString();
    elements.kpiUniqueDtcs.innerText = uniqueDtcs.toString();
    elements.kpiActivePrograms.innerText = activeProgs.toString();
    elements.kpiOpenIssues.innerText = openIssues.toString();
}

function getTotalPages() {
    if (appState.pageSize === 'all') return 1;
    return Math.max(1, Math.ceil(appState.filteredData.length / appState.pageSize));
}

function renderGridAndPagination() {
    const total = appState.filteredData.length;
    elements.registryTableBody.innerHTML = "";
    
    if (total === 0) {
        elements.registryTableBody.innerHTML = `
            <tr>
                <td colspan="${appState.columns.length || 10}" class="no-data">No diagnostic records found matching current filters.</td>
            </tr>
        `;
        elements.btnPagePrev.disabled = true;
        elements.btnPageNext.disabled = true;
        elements.pageNumDisplay.innerText = "Page 1 of 1";
        elements.paginationInfoText.innerText = "Showing 0-0 of 0 entries";
        return;
    }
    
    // Slicing pagination data
    let startIdx = 0;
    let endIdx = total;
    
    if (appState.pageSize !== 'all') {
        const totalPages = getTotalPages();
        if (appState.currentPage > totalPages) appState.currentPage = totalPages;
        
        startIdx = (appState.currentPage - 1) * appState.pageSize;
        endIdx = Math.min(total, startIdx + appState.pageSize);
        
        elements.btnPagePrev.disabled = appState.currentPage === 1;
        elements.btnPageNext.disabled = appState.currentPage === totalPages;
        elements.pageNumDisplay.innerText = `Page ${appState.currentPage} of ${totalPages}`;
    } else {
        elements.btnPagePrev.disabled = true;
        elements.btnPageNext.disabled = true;
        elements.pageNumDisplay.innerText = "Page 1 of 1";
    }
    
    elements.paginationInfoText.innerHTML = `Showing <b>${startIdx + 1}</b>-<b>${endIdx}</b> of <b>${total.toLocaleString()}</b> entries`;
    
    const pageData = appState.filteredData.slice(startIdx, endIdx);
    const statusOptions = ['New', 'Open', 'In Progress', 'Closed', 'Under Investigation'];
    
    pageData.forEach(row => {
        const tr = document.createElement('tr');
        tr.dataset.index = row.index;
        
        appState.columns.forEach(col => {
            const td = document.createElement('td');
            const cellValue = (row[col] !== undefined && row[col] !== null) ? row[col] : "";
            
            // Editable Column 1: Issue Status
            if (col === "Issue Status") {
                td.className = "editable-cell";
                const statusClass = String(cellValue).toLowerCase().replace(' ', '-');
                td.innerHTML = `<span class="status-tag ${statusClass}">${cellValue}</span>`;
                td.addEventListener('click', () => editStatusCell(td, row.index, cellValue, statusOptions));
            } 
            // Editable Column 2: Comments
            else if (col === "Comments") {
                td.className = "editable-cell";
                td.innerText = cellValue;
                td.addEventListener('click', () => editTextFieldCell(td, row.index, 'Comments', cellValue));
            } 
            // Editable Column 3: Author
            else if (col === "Author") {
                td.className = "editable-cell";
                td.innerText = cellValue;
                td.addEventListener('click', () => editTextFieldCell(td, row.index, 'Author', cellValue));
            }
            // Non-editable columns
            else {
                if (col === "Last Updated") {
                    td.className = "font-mono text-muted";
                    td.id = `updated-time-${row.index}`;
                } else if (col === "Code" || col === "VIN Number") {
                    td.className = "font-mono";
                }
                td.innerText = cellValue;
            }
            
            tr.appendChild(td);
        });
        
        elements.registryTableBody.appendChild(tr);
    });
}

// ----------------------------------------------------
// Inline Cell Editing Commits
// ----------------------------------------------------
function editStatusCell(td, rowIndex, currentVal, options) {
    if (td.querySelector('select')) return;
    
    const select = document.createElement('select');
    select.className = "cell-select";
    
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.innerText = opt;
        if (opt === currentVal) option.selected = true;
        select.appendChild(option);
    });
    
    td.innerHTML = "";
    td.appendChild(select);
    select.focus();
    
    const commitChange = () => {
        const newVal = select.value;
        if (newVal !== currentVal) {
            saveRowUpdate(rowIndex, { Issue_Status: newVal });
        } else {
            const statusClass = newVal.toLowerCase().replace(' ', '-');
            td.innerHTML = `<span class="status-tag ${statusClass}">${newVal}</span>`;
        }
    };
    
    select.addEventListener('blur', commitChange);
    select.addEventListener('change', commitChange);
}

function editTextFieldCell(td, rowIndex, fieldName, currentVal) {
    if (td.querySelector('input')) return;
    
    const input = document.createElement('input');
    input.type = "text";
    input.className = "cell-input";
    input.value = currentVal;
    
    td.innerHTML = "";
    td.appendChild(input);
    input.focus();
    
    const commitChange = () => {
        const newVal = input.value.trim();
        if (newVal !== currentVal) {
            const updatePayload = {};
            updatePayload[fieldName] = newVal;
            saveRowUpdate(rowIndex, updatePayload);
        } else {
            td.innerText = currentVal;
        }
    };
    
    input.addEventListener('blur', commitChange);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            commitChange();
        } else if (e.key === 'Escape') {
            td.innerText = currentVal;
        }
    });
}

function saveRowUpdate(rowIndex, updatePayload) {
    const rowEl = document.querySelector(`tr[data-index="${rowIndex}"]`);
    if (rowEl) {
        rowEl.classList.add('row-updating');
    }
    
    const recordIdx = appState.allData.findIndex(r => r.index === rowIndex);
    if (recordIdx === -1) return;
    
    const record = appState.allData[recordIdx];
    
    // Check key columns in dataset safely
    const commentsCol = appState.columns.includes("Comments") ? "Comments" : "";
    const authorCol = appState.columns.includes("Author") ? "Author" : "";
    const statusCol = appState.columns.includes("Issue Status") ? "Issue Status" : "";
    
    const finalPayload = {
        index: rowIndex,
        Comments: updatePayload.hasOwnProperty('Comments') ? updatePayload.Comments : (commentsCol ? record[commentsCol] : ""),
        Issue_Status: updatePayload.hasOwnProperty('Issue_Status') ? updatePayload.Issue_Status : (statusCol ? record[statusCol] : ""),
        Author: updatePayload.hasOwnProperty('Author') ? updatePayload.Author : (authorCol ? record[authorCol] : "")
    };
    
    fetch('/api/update-row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
    })
    .then(async res => {
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const detail = errData.detail || `HTTP error ${res.status}`;
            throw new Error(detail);
        }
        return res.json();
    })
    .then(result => {
        if (result.status === 'success') {
            // Update local state dynamically
            if (commentsCol) appState.allData[recordIdx][commentsCol] = finalPayload.Comments;
            if (statusCol) appState.allData[recordIdx][statusCol] = finalPayload.Issue_Status;
            if (authorCol) appState.allData[recordIdx][authorCol] = finalPayload.Author;
            
            if (appState.columns.includes("Last Updated")) {
                appState.allData[recordIdx]["Last Updated"] = result.last_updated;
            }
            
            if (rowEl) {
                rowEl.classList.remove('row-updating');
                rowEl.classList.add('row-success');
                setTimeout(() => rowEl.classList.remove('row-success'), 1200);
            }
            
            showToast("Database registry entry updated successfully.");
            
            // Sync filteredData
            const fIdx = appState.filteredData.findIndex(r => r.index === rowIndex);
            if (fIdx !== -1) {
                if (commentsCol) appState.filteredData[fIdx][commentsCol] = finalPayload.Comments;
                if (statusCol) appState.filteredData[fIdx][statusCol] = finalPayload.Issue_Status;
                if (authorCol) appState.filteredData[fIdx][authorCol] = finalPayload.Author;
                if (appState.columns.includes("Last Updated")) {
                    appState.filteredData[fIdx]["Last Updated"] = result.last_updated;
                }
            }
            
            updateKPIs();
            renderGridAndPagination();
            renderCharts();
        } else {
            throw new Error("Invalid response status from server");
        }
    })
    .catch(err => {
        logErrorToConsole("Save Row Update", err);
        showToast(`Save failed: ${err.message || err}`, "error");
        if (rowEl) rowEl.classList.remove('row-updating');
        renderGridAndPagination();
    });
}

// ----------------------------------------------------
// Adaptive Dashboard Visualizations (Respects System Colors)
// ----------------------------------------------------
function renderCharts() {
    const data = appState.filteredData;
    if (data.length === 0) return;
    
    const rootStyles = getComputedStyle(document.documentElement);
    const textSecColor = rootStyles.getPropertyValue('--text-secondary').trim() || '#94a3b8';
    const borderThemeColor = rootStyles.getPropertyValue('--border-color').trim() || 'rgba(0,0,0,0.1)';
    const fontTheme = rootStyles.getPropertyValue('--font-sans').trim() || 'sans-serif';
    
    // Find fields dynamically in case they exist under slightly altered casing
    const codeCol = appState.columns.find(c => c.toLowerCase() === "code") || "Code";
    const moduleCol = appState.columns.find(c => c.toLowerCase() === "module") || "Module";
    const statusCol = appState.columns.find(c => c.toLowerCase().includes("status")) || "Issue Status";
    const programCol = appState.columns.find(c => c.toLowerCase().includes("program")) || "Program name";
    
    const getCounts = (field, limit = 20) => {
        const counts = {};
        data.forEach(item => {
            const val = item[field];
            if (val) counts[val] = (counts[val] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);
    };

    // Chart 1: Top 20 DTCs by Count
    const dtcCounts = getCounts(codeCol, 20);
    const dtcLabels = dtcCounts.map(x => x[0]);
    const dtcValues = dtcCounts.map(x => x[1]);
    
    if (charts.topDtc) charts.topDtc.destroy();
    charts.topDtc = new Chart(document.getElementById('chart-top-dtc'), {
        type: 'bar',
        data: {
            labels: dtcLabels,
            datasets: [{
                label: 'Fault Occurrences',
                data: dtcValues,
                backgroundColor: 'rgba(59, 130, 246, 0.65)',
                borderColor: '#3b82f6',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { bodyFont: { family: fontTheme } }
            },
            scales: {
                y: { grid: { color: borderThemeColor }, ticks: { color: textSecColor, font: { size: 9, family: fontTheme } } },
                x: { grid: { display: false }, ticks: { color: textSecColor, font: { size: 9, family: fontTheme }, maxRotation: 45, minRotation: 45 } }
            }
        }
    });

    // Chart 2: Top Modules by DTC Count
    const modCounts = getCounts(moduleCol, 10);
    const modLabels = modCounts.map(x => x[0]);
    const modValues = modCounts.map(x => x[1]);
    
    if (charts.topModules) charts.topModules.destroy();
    charts.topModules = new Chart(document.getElementById('chart-top-modules'), {
        type: 'bar',
        data: {
            labels: modLabels,
            datasets: [{
                label: 'Total DTC Count',
                data: modValues,
                backgroundColor: 'rgba(13, 148, 136, 0.65)',
                borderColor: '#0d9488',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { bodyFont: { family: fontTheme } }
            },
            scales: {
                y: { grid: { color: borderThemeColor }, ticks: { color: textSecColor, font: { size: 9, family: fontTheme } } },
                x: { grid: { display: false }, ticks: { color: textSecColor, font: { size: 9, family: fontTheme } } }
            }
        }
    });

    // Chart 3: Horizontal Stacked Bar Chart
    const modules = [...new Set(data.map(item => item[moduleCol]).filter(Boolean))];
    const statuses = ['New', 'Open', 'In Progress', 'Closed', 'Under Investigation'];
    
    const statusMapByModule = {};
    modules.forEach(m => {
        statusMapByModule[m] = {};
        statuses.forEach(s => statusMapByModule[m][s] = 0);
    });
    
    data.forEach(item => {
        const m = item[moduleCol];
        const s = item[statusCol];
        if (m && s && statusMapByModule[m] && statusMapByModule[m].hasOwnProperty(s)) {
            statusMapByModule[m][s]++;
        }
    });
    
    const sortedModules = modules.map(m => {
        const sum = Object.values(statusMapByModule[m]).reduce((a, b) => a + b, 0);
        return { name: m, total: sum };
    }).sort((a, b) => b.total - a.total).map(x => x.name).slice(0, 10);
    
    const datasets = [
        { label: 'New', data: [], backgroundColor: 'rgba(59, 130, 246, 0.7)', stack: 'Status' },
        { label: 'Open', data: [], backgroundColor: 'rgba(6, 182, 212, 0.7)', stack: 'Status' },
        { label: 'In Progress', data: [], backgroundColor: 'rgba(245, 158, 11, 0.7)', stack: 'Status' },
        { label: 'Closed', data: [], backgroundColor: 'rgba(16, 185, 129, 0.7)', stack: 'Status' },
        { label: 'Under Investigation', data: [], backgroundColor: 'rgba(167, 139, 250, 0.7)', stack: 'Status' }
    ];
    
    sortedModules.forEach(m => {
        datasets[0].data.push(statusMapByModule[m]['New']);
        datasets[1].data.push(statusMapByModule[m]['Open']);
        datasets[2].data.push(statusMapByModule[m]['In Progress']);
        datasets[3].data.push(statusMapByModule[m]['Closed']);
        datasets[4].data.push(statusMapByModule[m]['Under Investigation']);
    });
    
    if (charts.statusModules) charts.statusModules.destroy();
    charts.statusModules = new Chart(document.getElementById('chart-status-modules'), {
        type: 'bar',
        data: {
            labels: sortedModules,
            datasets: datasets
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: textSecColor, boxWidth: 10, font: { size: 9, family: fontTheme } } },
                tooltip: { bodyFont: { family: fontTheme } }
            },
            scales: {
                x: { grid: { color: borderThemeColor }, ticks: { color: textSecColor, font: { size: 9, family: fontTheme } }, stacked: true },
                y: { grid: { display: false }, ticks: { color: textSecColor, font: { size: 9, family: fontTheme } }, stacked: true }
            }
        }
    });

    // Chart 4: Donut distribution
    const progCounts = getCounts(programCol, 8);
    const progLabels = progCounts.map(x => x[0]);
    const progValues = progCounts.map(x => x[1]);
    const neonColors = [
        'rgba(99, 102, 241, 0.75)',
        'rgba(236, 72, 153, 0.75)',
        'rgba(168, 85, 247, 0.75)',
        'rgba(14, 165, 233, 0.75)',
        'rgba(234, 179, 8, 0.75)',
        'rgba(20, 184, 166, 0.75)',
        'rgba(244, 63, 94, 0.75)',
        'rgba(16, 185, 129, 0.75)'
    ];
    
    const cardBorderColor = rootStyles.getPropertyValue('--border-color').trim() || '#e2e8f0';
    
    if (charts.programDist) charts.programDist.destroy();
    charts.programDist = new Chart(document.getElementById('chart-program-distribution'), {
        type: 'doughnut',
        data: {
            labels: progLabels,
            datasets: [{
                data: progValues,
                backgroundColor: neonColors.slice(0, progLabels.length),
                borderColor: cardBorderColor,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: textSecColor, boxWidth: 10, font: { size: 9, family: fontTheme } } },
                tooltip: { bodyFont: { family: fontTheme } }
            },
            cutout: '50%'
        }
    });
}

// ----------------------------------------------------
// Utility Actions (Excel, Toast, Debounce)
// ----------------------------------------------------
function exportToExcel() {
    showToast("Generating spreadsheet export... please wait.");
    window.open('/api/export', '_blank');
}

function showToast(message, type = "success") {
    elements.toastMessage.innerText = message;
    const iconEl = elements.toast.querySelector('.toast-icon');
    
    if (type === "error") {
        elements.toast.style.borderColor = "var(--error)";
        if (iconEl) {
            iconEl.innerText = "⚠️";
            iconEl.style.color = "var(--error)";
        }
    } else {
        elements.toast.style.borderColor = "var(--success)";
        if (iconEl) {
            iconEl.innerText = "✅";
            iconEl.style.color = "var(--success)";
        }
    }
    
    elements.toast.classList.remove('hidden');
    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function getJoinedPath(parent, child) {
    const isWindows = parent.includes('\\') || parent.includes(':');
    const sep = isWindows ? '\\' : '/';
    
    if (parent.endsWith(sep)) {
        return parent + child;
    }
    return parent + sep + child;
}

function getFolderName(path) {
    if (!path) return "";
    const isWindows = path.includes('\\');
    const parts = isWindows ? path.split('\\') : path.split('/');
    return parts.filter(Boolean).pop() || path;
}

// ----------------------------------------------------
// Global Error Handlers & Visual Logging Consolidation
// ----------------------------------------------------
function setupErrorLogging() {
    window.addEventListener('error', (event) => {
        logErrorToConsole("Unhandled Runtime Exception", event.error || event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
        logErrorToConsole("Unhandled Promise Rejection", event.reason);
    });
}

function logErrorToConsole(errContext, err) {
    console.error(`${errContext}:`, err);
    elements.logConsoleContainer.classList.remove('hidden');
    elements.logConsoleContainer.classList.remove('minimized');
    
    const message = err && err.message ? err.message : String(err);
    appendLogLine({
        message: `❌ [FRONTEND EXCEPTION] ${errContext}: ${message}`,
        level: "error",
        time: new Date().toTimeString().split(' ')[0]
    });
}
