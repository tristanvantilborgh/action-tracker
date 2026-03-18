import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, CheckCircle2, Circle, ArrowUpDown, Filter, FileText, Calendar, User, ClipboardList, X, ChevronDown, ChevronUp, Download, Trash2, Save, FolderOpen, List, Plus, Clock, Pencil } from 'lucide-react';

// Professional Action Point Tracker for Meeting Reports
// Extracts action points from XML meeting reports and allows tracking execution status

export default function ActiepuntenTracker() {
  const [actions, setActions] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'datum', direction: 'desc' });
  const [filterExecuted, setFilterExecuted] = useState('all'); // 'all', 'executed', 'pending', 'lopende'
  const [filterProject, setFilterProject] = useState('all');
  const [filterResponsible, setFilterResponsible] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // Modal state for steps
  const [selectedAction, setSelectedAction] = useState(null);
  const [newStepText, setNewStepText] = useState('');
  
  // Modal state for edit/create action
  const [editingAction, setEditingAction] = useState(null);
  const [showNewActionModal, setShowNewActionModal] = useState(false);
  const [actionForm, setActionForm] = useState({
    projectId: '',
    datum: '',
    verantwoordelijke: '',
    actie: ''
  });

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
          status: 'open', // 'open', 'lopende', 'afgerond'
          stappen: [],
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

  // Cycle through status: open -> lopende -> afgerond -> open (but not back to open if there are steps)
  const cycleStatus = (id) => {
    setActions(prev => prev.map(action => {
      if (action.id === id) {
        const currentStatus = action.status || 'open';
        const hasSteps = (action.stappen || []).length > 0;
        let newStatus;
        if (currentStatus === 'open') newStatus = 'lopende';
        else if (currentStatus === 'lopende') newStatus = 'afgerond';
        else {
          // From afgerond: go back to lopende if has steps, otherwise to open
          newStatus = hasSteps ? 'lopende' : 'open';
        }
        return { ...action, status: newStatus };
      }
      return action;
    }));
  };

  // Delete action
  const deleteAction = (id) => {
    setActions(prev => prev.filter(action => action.id !== id));
  };

  // Open steps modal for an action
  const openStepsModal = (actionId) => {
    const action = actions.find(a => a.id === actionId);
    if (action) {
      setSelectedAction(action);
      setNewStepText('');
    }
  };

  // Close steps modal
  const closeStepsModal = () => {
    setSelectedAction(null);
    setNewStepText('');
  };

  // Add a new step to an action
  const addStep = () => {
    if (!newStepText.trim() || !selectedAction) return;
    
    const now = new Date();
    const newStep = {
      id: `step-${Date.now()}`,
      datum: now.toISOString().split('T')[0],
      tijd: now.toTimeString().slice(0, 5),
      beschrijving: newStepText.trim()
    };
    
    setActions(prev => prev.map(action => 
      action.id === selectedAction.id 
        ? { 
            ...action, 
            stappen: [...(action.stappen || []), newStep],
            // Automatically set status to 'lopende' when adding steps
            status: (action.status === 'open' || !action.status) ? 'lopende' : action.status
          }
        : action
    ));
    
    // Update selected action to reflect changes
    setSelectedAction(prev => ({
      ...prev,
      stappen: [...(prev.stappen || []), newStep],
      status: (prev.status === 'open' || !prev.status) ? 'lopende' : prev.status
    }));
    
    setNewStepText('');
    showNotification('Stap toegevoegd', 'success');
  };

  // Delete a step from an action
  const deleteStep = (actionId, stepId) => {
    setActions(prev => prev.map(action => 
      action.id === actionId 
        ? { ...action, stappen: (action.stappen || []).filter(s => s.id !== stepId) }
        : action
    ));
    
    // Update selected action to reflect changes
    if (selectedAction && selectedAction.id === actionId) {
      setSelectedAction(prev => ({
        ...prev,
        stappen: (prev.stappen || []).filter(s => s.id !== stepId)
      }));
    }
  };

  // Open new action modal
  const openNewActionModal = () => {
    setActionForm({
      projectId: '',
      datum: new Date().toISOString().split('T')[0],
      verantwoordelijke: '',
      actie: ''
    });
    setShowNewActionModal(true);
    setEditingAction(null);
  };

  // Open edit action modal
  const openEditActionModal = (action) => {
    setActionForm({
      projectId: action.projectId,
      datum: action.datum,
      verantwoordelijke: action.verantwoordelijke,
      actie: action.actie
    });
    setEditingAction(action);
    setShowNewActionModal(false);
  };

  // Close action modal
  const closeActionModal = () => {
    setShowNewActionModal(false);
    setEditingAction(null);
    setActionForm({
      projectId: '',
      datum: '',
      verantwoordelijke: '',
      actie: ''
    });
  };

  // Save new or edited action
  const saveAction = () => {
    if (!actionForm.actie.trim()) {
      showNotification('Vul de actie in', 'error');
      return;
    }
    if (!actionForm.projectId.trim()) {
      showNotification('Vul het project ID in', 'error');
      return;
    }
    if (!actionForm.verantwoordelijke.trim()) {
      showNotification('Vul de verantwoordelijke in', 'error');
      return;
    }

    if (editingAction) {
      // Update existing action
      setActions(prev => prev.map(action => 
        action.id === editingAction.id 
          ? { 
              ...action, 
              projectId: actionForm.projectId.trim(),
              datum: actionForm.datum,
              verantwoordelijke: actionForm.verantwoordelijke.trim(),
              actie: actionForm.actie.trim()
            }
          : action
      ));
      showNotification('Actiepunt bijgewerkt', 'success');
    } else {
      // Create new action
      const newAction = {
        id: `manual-${Date.now()}`,
        projectId: actionForm.projectId.trim(),
        datum: actionForm.datum,
        subject: '',
        verantwoordelijke: actionForm.verantwoordelijke.trim(),
        actie: actionForm.actie.trim(),
        status: 'open',
        stappen: [],
        toegevoegdOp: new Date().toISOString()
      };
      setActions(prev => [...prev, newAction]);
      showNotification('Actiepunt toegevoegd', 'success');
    }
    
    closeActionModal();
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
      const status = action.status || 'open';
      if (filterExecuted === 'executed' && status !== 'afgerond') return false;
      if (filterExecuted === 'pending' && status !== 'open') return false;
      if (filterExecuted === 'lopende' && status !== 'lopende') return false;
      if (filterProject !== 'all' && action.projectId !== filterProject) return false;
      if (filterResponsible !== 'all' && action.verantwoordelijke !== filterResponsible) return false;
      return true;
    })
    .sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (sortConfig.key === 'status') {
        const statusOrder = { 'open': 0, 'lopende': 1, 'afgerond': 2 };
        aVal = statusOrder[a.status || 'open'];
        bVal = statusOrder[b.status || 'open'];
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  // Stats
  const totalActions = actions.length;
  const completedActions = actions.filter(a => (a.status || 'open') === 'afgerond').length;
  const lopendeActions = actions.filter(a => (a.status || 'open') === 'lopende').length;
  const pendingActions = actions.filter(a => (a.status || 'open') === 'open').length;

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Project ID', 'Datum', 'Verantwoordelijke', 'Actie', 'Stappen', 'Status'];
    const statusLabels = { 'open': 'Open', 'lopende': 'Lopende', 'afgerond': 'Afgerond' };
    const rows = filteredActions.map(a => [
      a.projectId,
      a.datum,
      a.verantwoordelijke,
      `"${a.actie.replace(/"/g, '""')}"`,
      (a.stappen || []).length,
      statusLabels[a.status || 'open']
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
      xml += `      <status>${escapeXML(action.status || 'open')}</status>\n`;
      xml += `      <toegevoegdOp>${escapeXML(action.toegevoegdOp || '')}</toegevoegdOp>\n`;
      
      // Export stappen (steps)
      if (action.stappen && action.stappen.length > 0) {
        xml += '      <stappen>\n';
        action.stappen.forEach(stap => {
          xml += '        <stap>\n';
          xml += `          <id>${escapeXML(stap.id)}</id>\n`;
          xml += `          <datum>${escapeXML(stap.datum)}</datum>\n`;
          xml += `          <tijd>${escapeXML(stap.tijd)}</tijd>\n`;
          xml += `          <beschrijving>${escapeXML(stap.beschrijving)}</beschrijving>\n`;
          xml += '        </stap>\n';
        });
        xml += '      </stappen>\n';
      }
      
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

  // Helper function to get text content of direct child element by tag name
  const getChildText = (parent, tagName) => {
    const children = parent.childNodes;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.nodeType === 1 && child.nodeName.toLowerCase() === tagName.toLowerCase()) {
        return child.textContent || '';
      }
    }
    return '';
  };

  // Helper function to get direct child element by tag name
  const getChildElement = (parent, tagName) => {
    const children = parent.childNodes;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.nodeType === 1 && child.nodeName.toLowerCase() === tagName.toLowerCase()) {
        return child;
      }
    }
    return null;
  };

  // Helper function to get all direct child elements by tag name
  const getChildElements = (parent, tagName) => {
    const result = [];
    const children = parent.childNodes;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.nodeType === 1 && child.nodeName.toLowerCase() === tagName.toLowerCase()) {
        result.push(child);
      }
    }
    return result;
  };

  // Parse saved XML file and load actions
  const parseTrackerXML = (xmlString) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Ongeldig XML-bestand');
    }

    // Check if this is a tracker XML file
    const root = xmlDoc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'actiepunten_tracker') {
      throw new Error('Dit is geen geldig actiepunten tracker bestand');
    }

    // Find acties container
    const actiesContainer = getChildElement(root, 'acties');
    if (!actiesContainer) {
      throw new Error('Geen acties gevonden in bestand');
    }
    
    const actionElements = getChildElements(actiesContainer, 'actie');
    const loadedActions = [];

    for (let i = 0; i < actionElements.length; i++) {
      const actionEl = actionElements[i];
      
      // Get direct child values
      const id = getChildText(actionEl, 'id') || `loaded-${Date.now()}-${Math.random()}`;
      const projectId = getChildText(actionEl, 'projectId') || 'Onbekend';
      const datum = getChildText(actionEl, 'datum') || '';
      const subject = getChildText(actionEl, 'subject') || '';
      const verantwoordelijke = getChildText(actionEl, 'verantwoordelijke') || 'Niet toegewezen';
      const tekst = getChildText(actionEl, 'tekst') || '';
      
      // Get status - support both new 'status' field and legacy 'uitgevoerd' field
      let status = getChildText(actionEl, 'status');
      if (!status) {
        // Backwards compatibility: convert uitgevoerd boolean to status
        const uitgevoerd = getChildText(actionEl, 'uitgevoerd') === 'true';
        status = uitgevoerd ? 'afgerond' : 'open';
      }
      // Validate status
      if (!['open', 'lopende', 'afgerond'].includes(status)) {
        status = 'open';
      }
      
      const toegevoegdOp = getChildText(actionEl, 'toegevoegdOp') || '';

      // Parse stappen (steps)
      const stappen = [];
      const stappenContainer = getChildElement(actionEl, 'stappen');
      if (stappenContainer) {
        const stapElements = getChildElements(stappenContainer, 'stap');
        for (let j = 0; j < stapElements.length; j++) {
          const stapEl = stapElements[j];
          stappen.push({
            id: getChildText(stapEl, 'id') || `step-${Date.now()}-${Math.random()}`,
            datum: getChildText(stapEl, 'datum') || '',
            tijd: getChildText(stapEl, 'tijd') || '',
            beschrijving: getChildText(stapEl, 'beschrijving') || ''
          });
        }
      }

      if (tekst) {
        loadedActions.push({
          id,
          projectId,
          datum,
          subject,
          verantwoordelijke,
          actie: tekst,
          status,
          stappen,
          toegevoegdOp
        });
      }
    }

    return loadedActions;
  };
        loadedActions.push({
          id,
          projectId,
          datum,
          subject,
          verantwoordelijke,
          actie: tekst,
          status,
          stappen,
          toegevoegdOp
        });
      }
    }

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
      
      // Count stats for notification
      const withStappen = loadedActions.filter(a => a.stappen && a.stappen.length > 0).length;
      const lopende = loadedActions.filter(a => a.status === 'lopende').length;
      const afgerond = loadedActions.filter(a => a.status === 'afgerond').length;
      
      showNotification(`${loadedActions.length} actiepunten geladen (${lopende} lopende, ${afgerond} afgerond, ${withStappen} met stappen)`, 'success');
    } catch (error) {
      console.error('Load error:', error);
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
                  onClick={openNewActionModal}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium"
                  style={{ backgroundColor: '#10b981' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                >
                  <Plus size={16} />
                  Nieuw
                </button>
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
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
                  CSV
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
                  onClick={openNewActionModal}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium"
                  style={{ backgroundColor: '#10b981' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                >
                  <Plus size={16} />
                  Nieuw
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
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        {actions.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-8">
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
                  <p className="text-sm text-slate-500 font-medium">Open</p>
                  <p className="text-3xl font-bold text-slate-600 mt-1">{pendingActions}</p>
                </div>
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                  <Circle className="text-slate-500" size={22} />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">Lopende</p>
                  <p className="text-3xl font-bold text-orange-500 mt-1">{lopendeActions}</p>
                </div>
                <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
                  <Clock className="text-orange-500" size={22} />
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
                  <option value="pending">Open</option>
                  <option value="lopende">Lopende</option>
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
                    <th className="px-4 py-3 text-left font-semibold" style={{ minWidth: '400px' }}>Actie</th>
                    <th className="px-4 py-3 text-left font-semibold">Stappen</th>
                    <SortableHeader label="Status" sortKey="status" icon={CheckCircle2} />
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActions.map((action) => (
                    <tr 
                      key={action.id} 
                      className={`hover:bg-slate-50 transition-colors ${
                        (action.status || 'open') === 'afgerond' ? 'bg-emerald-50/30' : 
                        (action.status || 'open') === 'lopende' ? 'bg-orange-50/30' : ''
                      }`}
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
                      <td className="px-4 py-4 text-sm text-slate-700" style={{ minWidth: '400px' }}>
                        <p className={(action.status || 'open') === 'afgerond' ? 'line-through text-slate-400' : ''}>
                          {action.actie}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => openStepsModal(action.id)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all bg-blue-50 text-blue-700 hover:bg-blue-100"
                          style={{ borderColor: '#1E64C8' }}
                        >
                          <List size={14} />
                          <span>{(action.stappen || []).length}</span>
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => cycleStatus(action.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            (action.status || 'open') === 'afgerond'
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : (action.status || 'open') === 'lopende'
                              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {(action.status || 'open') === 'afgerond' ? (
                            <>
                              <CheckCircle2 size={16} />
                              <span>Afgerond</span>
                            </>
                          ) : (action.status || 'open') === 'lopende' ? (
                            <>
                              <Clock size={16} />
                              <span>Lopende</span>
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
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditActionModal(action)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Bewerken"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => deleteAction(action.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Verwijderen"
                          >
                            <X size={16} />
                          </button>
                        </div>
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

      {/* Steps Modal */}
      {selectedAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold" style={{ color: '#1E64C8' }}>Stappen</h2>
                <p className="text-sm text-slate-500 mt-1 line-clamp-1">{selectedAction.actie}</p>
              </div>
              <button
                onClick={closeStepsModal}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            
            {/* Modal Body - Steps List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {(!selectedAction.stappen || selectedAction.stappen.length === 0) ? (
                <div className="text-center py-8 text-slate-400">
                  <Clock size={40} className="mx-auto mb-3 opacity-50" />
                  <p>Nog geen stappen geregistreerd</p>
                  <p className="text-sm mt-1">Voeg hieronder een stap toe</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedAction.stappen.map((stap, index) => (
                    <div
                      key={stap.id}
                      className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100"
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: '#1E64C8' }}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700">{stap.beschrijving}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {formatDate(stap.datum)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {stap.tijd}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteStep(selectedAction.id, stap.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Verwijderen"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Modal Footer - Add Step */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newStepText}
                  onChange={(e) => setNewStepText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addStep()}
                  placeholder="Beschrijf de stap..."
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                />
                <button
                  onClick={addStep}
                  disabled={!newStepText.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: newStepText.trim() ? '#1E64C8' : '#94a3b8' }}
                >
                  <Plus size={16} />
                  Toevoegen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Create Action Modal */}
      {(showNewActionModal || editingAction) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: '#1E64C8' }}>
                {editingAction ? 'Actiepunt bewerken' : 'Nieuw actiepunt'}
              </h2>
              <button
                onClick={closeActionModal}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            
            {/* Modal Body - Form */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Project ID *</label>
                <input
                  type="text"
                  value={actionForm.projectId}
                  onChange={(e) => setActionForm(prev => ({ ...prev, projectId: e.target.value }))}
                  placeholder="bijv. PR3ARCHIT"
                  className="w-full text-sm border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Datum *</label>
                <input
                  type="date"
                  value={actionForm.datum}
                  onChange={(e) => setActionForm(prev => ({ ...prev, datum: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Verantwoordelijke *</label>
                <input
                  type="text"
                  value={actionForm.verantwoordelijke}
                  onChange={(e) => setActionForm(prev => ({ ...prev, verantwoordelijke: e.target.value }))}
                  placeholder="Naam van de verantwoordelijke"
                  className="w-full text-sm border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Actie *</label>
                <textarea
                  value={actionForm.actie}
                  onChange={(e) => setActionForm(prev => ({ ...prev, actie: e.target.value }))}
                  placeholder="Beschrijf het actiepunt..."
                  rows={4}
                  className="w-full text-sm border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={closeActionModal}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={saveAction}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all"
                style={{ backgroundColor: '#1E64C8' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#174ea0'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1E64C8'}
              >
                <Save size={16} />
                {editingAction ? 'Opslaan' : 'Toevoegen'}
              </button>
            </div>
          </div>
        </div>
      )}

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
