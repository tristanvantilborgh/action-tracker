import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, CheckCircle2, Circle, ArrowUpDown, Filter, FileText, Calendar, User, ClipboardList, X, ChevronDown, ChevronUp, Download, Trash2, Save, FolderOpen } from 'lucide-react';

// Professional Action Point Tracker for Meeting Reports
// Extracts action points from XML meeting reports and allows tracking execution status

export default function ActiepuntenTracker() {
  const [actions, setActions] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'datum', direction: 'desc' });
  const [filterExecuted, setFilterExecuted] = useState('all'); // 'all', 'executed', 'pending'
  const [filterProject, setFilterProject] = useState('all');
  const [filterResponsible, setFilterResponsible] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [notification, setNotification] = useState(null);

  // Load saved actions from storage on mount
  useEffect(() => {
    const loadActions = async () => {
      try {
        const result = await window.storage.get('actiepunten-data');
        if (result && result.value) {
          setActions(JSON.parse(result.value));
        }
      } catch (error) {
        console.log('No existing data found, starting fresh');
      }
      setIsLoading(false);
    };
    loadActions();
  }, []);

  // Save actions to storage whenever they change
  useEffect(() => {
    const saveActions = async () => {
      if (!isLoading && actions.length > 0) {
        try {
          await window.storage.set('actiepunten-data', JSON.stringify(actions));
        } catch (error) {
          console.error('Failed to save actions:', error);
        }
      }
    };
    saveActions();
  }, [actions, isLoading]);

  // Parse XML and extract action points
  const parseXML = (xmlString) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Ongeldig XML-bestand');
    }
    
    // Extract metadata
    const projectId = xmlDoc.querySelector('meta > projectId')?.textContent || 'Onbekend';
    const date = xmlDoc.querySelector('meta > date')?.textContent || new Date().toISOString().split('T')[0];
    const subject = xmlDoc.querySelector('meta > subject')?.textContent || '';
    
    // Extract actions
    const actionElements = xmlDoc.querySelectorAll('actions > action');
    const newActions = [];
    
    actionElements.forEach((actionEl, index) => {
      const text = actionEl.querySelector('text')?.textContent?.trim() || '';
      const assignee = actionEl.querySelector('assignee')?.textContent?.trim() || 'Niet toegewezen';
      
      if (text) {
        const actionId = `${projectId}-${date}-${index}-${Date.now()}`;
        newActions.push({
          id: actionId,
          projectId,
          datum: date,
          subject,
          verantwoordelijke: assignee,
          actie: text,
          uitgevoerd: false,
          opmerking: '',
          toegevoegdOp: new Date().toISOString()
        });
      }
    });
    
    return newActions;
  };

  // Handle file upload
  const handleFileUpload = async (file) => {
    if (!file || !file.name.endsWith('.xml')) {
      showNotification('Selecteer een geldig XML-bestand', 'error');
      return;
    }
    
    try {
      const text = await file.text();
      const newActions = parseXML(text);
      
      if (newActions.length === 0) {
        showNotification('Geen actiepunten gevonden in dit bestand', 'warning');
        return;
      }
      
      // Check for duplicates based on project, date, and action text
      const existingKeys = new Set(actions.map(a => `${a.projectId}-${a.datum}-${a.actie}`));
      const uniqueNewActions = newActions.filter(a => !existingKeys.has(`${a.projectId}-${a.datum}-${a.actie}`));
      
      if (uniqueNewActions.length === 0) {
        showNotification('Alle actiepunten uit dit verslag zijn al toegevoegd', 'warning');
        return;
      }
      
      setActions(prev => [...prev, ...uniqueNewActions]);
      showNotification(`${uniqueNewActions.length} actiepunt${uniqueNewActions.length > 1 ? 'en' : ''} toegevoegd uit ${newActions[0]?.subject || 'verslag'}`, 'success');
    } catch (error) {
      showNotification(`Fout bij verwerken: ${error.message}`, 'error');
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  };

  const handleInputChange = (e) => {
    const file = e.target.files[0];
    handleFileUpload(file);
    e.target.value = '';
  };

  // Show notification
  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Toggle executed status
  const toggleExecuted = (id) => {
    setActions(prev => prev.map(action => 
      action.id === id ? { ...action, uitgevoerd: !action.uitgevoerd } : action
    ));
  };

  // Update remark
  const updateOpmerking = (id, opmerking) => {
    setActions(prev => prev.map(action => 
      action.id === id ? { ...action, opmerking } : action
    ));
  };

  // Delete action
  const deleteAction = (id) => {
    setActions(prev => prev.filter(action => action.id !== id));
  };

  // Clear all data
  const clearAllData = async () => {
    if (window.confirm('Weet je zeker dat je alle actiepunten wilt verwijderen?')) {
      setActions([]);
      try {
        await window.storage.delete('actiepunten-data');
      } catch (error) {
        console.error('Failed to clear storage:', error);
      }
      showNotification('Alle actiepunten verwijderd', 'success');
    }
  };

  // Sorting
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get unique values for filters
  const uniqueProjects = [...new Set(actions.map(a => a.projectId))].sort();
  const uniqueResponsibles = [...new Set(actions.map(a => a.verantwoordelijke))].sort();

  // Filter and sort actions
  const filteredActions = actions
    .filter(action => {
      if (filterExecuted === 'executed' && !action.uitgevoerd) return false;
      if (filterExecuted === 'pending' && action.uitgevoerd) return false;
      if (filterProject !== 'all' && action.projectId !== filterProject) return false;
      if (filterResponsible !== 'all' && action.verantwoordelijke !== filterResponsible) return false;
      return true;
    })
    .sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (sortConfig.key === 'uitgevoerd') {
        aVal = a.uitgevoerd ? 1 : 0;
        bVal = b.uitgevoerd ? 1 : 0;
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  // Stats
  const totalActions = actions.length;
  const completedActions = actions.filter(a => a.uitgevoerd).length;
  const pendingActions = totalActions - completedActions;

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Project ID', 'Datum', 'Verantwoordelijke', 'Actie', 'Uitgevoerd', 'Opmerking'];
    const rows = filteredActions.map(a => [
      a.projectId,
      a.datum,
      a.verantwoordelijke,
      `"${a.actie.replace(/"/g, '""')}"`,
      a.uitgevoerd ? 'Ja' : 'Nee',
      `"${a.opmerking.replace(/"/g, '""')}"`
    ]);
    
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `actiepunten-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showNotification('Export succesvol gedownload', 'success');
  };

  // Generate filename with format YYYYMMDD_HHMMSS_actiepunten-logboek.xml
  const generateFilename = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}_actiepunten-logboek.xml`;
  };

  // Escape XML special characters
  const escapeXML = (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // Save actions to XML file
  const saveToXML = () => {
    if (actions.length === 0) {
      showNotification('Geen actiepunten om te bewaren', 'warning');
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<actiepunten_tracker version="1" exportDate="' + dateStr + '">\n';
    xml += '  <acties>\n';
    
    actions.forEach(action => {
      xml += '    <actie>\n';
      xml += `      <id>${escapeXML(action.id)}</id>\n`;
      xml += `      <projectId>${escapeXML(action.projectId)}</projectId>\n`;
      xml += `      <datum>${escapeXML(action.datum)}</datum>\n`;
      xml += `      <subject>${escapeXML(action.subject || '')}</subject>\n`;
      xml += `      <verantwoordelijke>${escapeXML(action.verantwoordelijke)}</verantwoordelijke>\n`;
      xml += `      <tekst>${escapeXML(action.actie)}</tekst>\n`;
      xml += `      <uitgevoerd>${action.uitgevoerd ? 'true' : 'false'}</uitgevoerd>\n`;
      xml += `      <opmerking>${escapeXML(action.opmerking)}</opmerking>\n`;
      xml += `      <toegevoegdOp>${escapeXML(action.toegevoegdOp || '')}</toegevoegdOp>\n`;
      xml += '    </actie>\n';
    });
    
    xml += '  </acties>\n';
    xml += '</actiepunten_tracker>';
    
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = generateFilename();
    link.click();
    URL.revokeObjectURL(url);
    showNotification(`Actiepunten bewaard als ${generateFilename()}`, 'success');
  };

  // Reference for hidden file input
  const loadFileInputRef = useRef(null);

  // Parse saved XML file and load actions
  const parseTrackerXML = (xmlString) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Ongeldig XML-bestand');
    }

    // Check if this is a tracker XML file
    const root = xmlDoc.querySelector('actiepunten_tracker');
    if (!root) {
      throw new Error('Dit is geen geldig actiepunten tracker bestand');
    }

    const actionElements = xmlDoc.querySelectorAll('acties > actie');
    const loadedActions = [];

    actionElements.forEach(actionEl => {
      const id = actionEl.querySelector('id')?.textContent || `loaded-${Date.now()}-${Math.random()}`;
      const projectId = actionEl.querySelector('projectId')?.textContent || 'Onbekend';
      const datum = actionEl.querySelector('datum')?.textContent || '';
      const subject = actionEl.querySelector('subject')?.textContent || '';
      const verantwoordelijke = actionEl.querySelector('verantwoordelijke')?.textContent || 'Niet toegewezen';
      const tekst = actionEl.querySelector('tekst')?.textContent || '';
      const uitgevoerd = actionEl.querySelector('uitgevoerd')?.textContent === 'true';
      const opmerking = actionEl.querySelector('opmerking')?.textContent || '';
      const toegevoegdOp = actionEl.querySelector('toegevoegdOp')?.textContent || '';

      if (tekst) {
        loadedActions.push({
          id,
          projectId,
          datum,
          subject,
          verantwoordelijke,
          actie: tekst,
          uitgevoerd,
          opmerking,
          toegevoegdOp
        });
      }
    });

    return loadedActions;
  };

  // Load actions from XML file
  const loadFromXML = async (file) => {
    if (!file || !file.name.endsWith('.xml')) {
      showNotification('Selecteer een geldig XML-bestand', 'error');
      return;
    }

    try {
      const text = await file.text();
      const loadedActions = parseTrackerXML(text);

      if (loadedActions.length === 0) {
        showNotification('Geen actiepunten gevonden in dit bestand', 'warning');
        return;
      }

      // Replace all current actions with loaded ones
      setActions(loadedActions);
      showNotification(`${loadedActions.length} actiepunt${loadedActions.length > 1 ? 'en' : ''} geladen`, 'success');
    } catch (error) {
      showNotification(`Fout bij laden: ${error.message}`, 'error');
    }
  };

  // Handle load file input change
  const handleLoadFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      loadFromXML(file);
    }
    e.target.value = '';
  };

  // Format date for display
  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('nl-BE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const SortableHeader = ({ label, sortKey, icon: Icon }) => (
    <th 
      onClick={() => handleSort(sortKey)}
      className="px-4 py-3 text-left font-semibold cursor-pointer hover:bg-slate-100 transition-colors select-none"
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon size={14} className="text-slate-400" />}
        <span>{label}</span>
        <div className="flex flex-col ml-1">
          <ChevronUp 
            size={10} 
            className={sortConfig.key === sortKey && sortConfig.direction === 'asc' ? 'text-blue-600' : 'text-slate-300'} 
          />
          <ChevronDown 
            size={10} 
            className={sortConfig.key === sortKey && sortConfig.direction === 'desc' ? 'text-blue-600' : 'text-slate-300'} 
          />
        </div>
      </div>
    </th>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100" style={{ fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in ${
          notification.type === 'success' ? 'bg-emerald-600 text-white' :
          notification.type === 'error' ? 'bg-red-600 text-white' :
          'bg-amber-500 text-white'
        }`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="hover:opacity-70">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1E64C8' }}>ACTIEPUNTEN</h1>
              <p className="text-sm text-slate-500">Beheer van actiepunten uit vergaderverslagen</p>
            </div>
            
            {actions.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={saveToXML}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium"
                  style={{ backgroundColor: '#1E64C8' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#174ea0'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1E64C8'}
                >
                  <Save size={16} />
                  Bewaar
                </button>
                <button
                  onClick={() => loadFileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border-2 rounded-lg transition-colors text-sm font-medium"
                  style={{ borderColor: '#1E64C8', color: '#1E64C8' }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#1E64C8'; e.currentTarget.style.color = 'white'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#1E64C8'; }}
                >
                  <FolderOpen size={16} />
                  Lees
                </button>
                <input
                  type="file"
                  ref={loadFileInputRef}
                  accept=".xml"
                  onChange={handleLoadFileChange}
                  className="hidden"
                />
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium"
                >
                  <Download size={16} />
                  Exporteer CSV
                </button>
                <button
                  onClick={clearAllData}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors text-sm font-medium"
                >
                  <Trash2 size={16} />
                  Wis alles
                </button>
              </div>
            )}
            {actions.length === 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => loadFileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border-2 rounded-lg transition-colors text-sm font-medium"
                  style={{ borderColor: '#1E64C8', color: '#1E64C8' }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#1E64C8'; e.currentTarget.style.color = 'white'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#1E64C8'; }}
                >
                  <FolderOpen size={16} />
                  Lees
                </button>
                <input
                  type="file"
                  ref={loadFileInputRef}
                  accept=".xml"
                  onChange={handleLoadFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        {actions.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">Totaal</p>
                  <p className="text-3xl font-bold text-slate-800 mt-1">{totalActions}</p>
                </div>
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                  <ClipboardList className="text-slate-500" size={22} />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">Afgerond</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">{completedActions}</p>
                </div>
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="text-emerald-500" size={22} />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">Openstaand</p>
                  <p className="text-3xl font-bold text-amber-600 mt-1">{pendingActions}</p>
                </div>
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center">
                  <Circle className="text-amber-500" size={22} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative mb-8 border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
            dragOver 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <input
            type="file"
            accept=".xml"
            onChange={handleInputChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              dragOver ? 'bg-blue-100' : 'bg-slate-100'
            }`}>
              <Upload className={dragOver ? 'text-blue-600' : 'text-slate-400'} size={26} />
            </div>
            <div>
              <p className="text-base font-medium text-slate-700">
                {dragOver ? 'Laat los om te uploaden' : 'Sleep een XML-verslag hierheen'}
              </p>
              <p className="text-sm text-slate-500 mt-1">of klik om een bestand te selecteren</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        {actions.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-600">Filters:</span>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500">Status:</label>
                <select
                  value={filterExecuted}
                  onChange={(e) => setFilterExecuted(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Alle</option>
                  <option value="pending">Openstaand</option>
                  <option value="executed">Afgerond</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500">Project:</label>
                <select
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Alle projecten</option>
                  {uniqueProjects.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500">Verantwoordelijke:</label>
                <select
                  value={filterResponsible}
                  onChange={(e) => setFilterResponsible(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Alle personen</option>
                  {uniqueResponsibles.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              
              {(filterExecuted !== 'all' || filterProject !== 'all' || filterResponsible !== 'all') && (
                <button
                  onClick={() => {
                    setFilterExecuted('all');
                    setFilterProject('all');
                    setFilterResponsible('all');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Wis filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Actions Table */}
        {actions.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <FileText className="mx-auto text-slate-300 mb-4" size={48} />
            <h3 className="text-lg font-medium text-slate-700 mb-2">Nog geen actiepunten</h3>
            <p className="text-slate-500">Upload een XML-verslag om actiepunten te importeren</p>
          </div>
        ) : filteredActions.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Filter className="mx-auto text-slate-300 mb-4" size={48} />
            <h3 className="text-lg font-medium text-slate-700 mb-2">Geen resultaten</h3>
            <p className="text-slate-500">Pas de filters aan om actiepunten te zien</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600">
                  <tr>
                    <SortableHeader label="Project" sortKey="projectId" icon={FileText} />
                    <SortableHeader label="Datum" sortKey="datum" icon={Calendar} />
                    <SortableHeader label="Verantwoordelijke" sortKey="verantwoordelijke" icon={User} />
                    <th className="px-4 py-3 text-left font-semibold">Actie</th>
                    <SortableHeader label="Status" sortKey="uitgevoerd" icon={CheckCircle2} />
                    <th className="px-4 py-3 text-left font-semibold">Opmerking uitvoering</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActions.map((action) => (
                    <tr 
                      key={action.id} 
                      className={`hover:bg-slate-50 transition-colors ${action.uitgevoerd ? 'bg-emerald-50/30' : ''}`}
                    >
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-sm font-mono font-medium">
                          {action.projectId}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 whitespace-nowrap">
                        {formatDate(action.datum)}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700 font-medium">
                        {action.verantwoordelijke}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700 max-w-md">
                        <p className={action.uitgevoerd ? 'line-through text-slate-400' : ''}>
                          {action.actie}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => toggleExecuted(action.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            action.uitgevoerd
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {action.uitgevoerd ? (
                            <>
                              <CheckCircle2 size={16} />
                              <span>Afgerond</span>
                            </>
                          ) : (
                            <>
                              <Circle size={16} />
                              <span>Open</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <input
                          type="text"
                          value={action.opmerking}
                          onChange={(e) => updateOpmerking(action.id, e.target.value)}
                          placeholder="Voeg opmerking toe..."
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white placeholder-slate-400"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => deleteAction(action.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Verwijderen"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Table Footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-sm text-slate-500">
              {filteredActions.length} van {actions.length} actiepunt{actions.length !== 1 ? 'en' : ''} weergegeven
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-400">
          Actiepunten • Data wordt lokaal opgeslagen
        </div>
      </footer>

      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
