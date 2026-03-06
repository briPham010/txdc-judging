import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const STORAGE_KEY = 'texas-diabolo-final-v6';

  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('auth_token') === 'valid';
  });
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- DATA LOADING ---
  const loadState = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const updatedCompetitors = parsed.competitors.map(c => ({
        ...c,
        deductions: c.deductions || { minor: 0, normal: 0, major: 0 }
      }));
      return { 
        ...parsed, 
        competitors: updatedCompetitors,
        judgeRole: parsed.judgeRole || 'All-in-One'
      };
    }
    return {
      competitors: [],
      divisions: ['Open', 'Regional Open', 'Regional Under 18', 'Teams'],
      weights: { oneD: 1.0, twoD: 1.0, threeD: 1.0, fourD: 1.0, vertax: 1.0 },
      teamWeights: { team1D: 1.0, team2D: 1.0, team3D: 1.0, teamVertax: 1.0, teamLong: 1.0 },
      judgeRole: 'All-in-One'
    };
  };

  const [data, setData] = useState(loadState);
  const [view, setView] = useState('register'); // register, judge, results, analysis, master
  const [currentDivision, setCurrentDivision] = useState(data.divisions[0]);
  const [judgeTab, setJudgeTab] = useState('tech'); 
  const [analysisTab, setAnalysisTab] = useState('tech'); 
  const [judgeSelection, setJudgeSelection] = useState(null);
  const [currentCompetitorName, setCurrentCompetitorName] = useState('');
  
  // Master Compiler State
  const [masterResults, setMasterResults] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // Active Scoring Buffer
  const [currentScores, setCurrentScores] = useState({
    technical: { oneD: 0, twoD: 0, threeD: 0, fourD: 0, vertax: 0, team1D: 0, team2D: 0, team3D: 0, teamVertax: 0, teamLong: 0 },
    performance: { stage: 0, style: 0, control: 0, music: 0, comp: 0, stageUsage: 0, sync: 0 },
    deductions: { minor: 0, normal: 0, major: 0 }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // --- Mappings ---
  const soloTechLabels = { oneD: "1D", twoD: "2D", threeD: "3D", fourD: "4D", vertax: "Vertax" };
  const soloPerfLabels = { stage: "Stage Presence", style: "Style", control: "Control", music: "Musicality", comp: "Composition" };

  const teamTechLabels = { team1D: "1D Team Tricks", team2D: "2D Team Tricks", team3D: "3D Team Tricks", teamVertax: "Vertax Team Tricks", teamLong: "Longstring" };
  const teamPerfLabels = { stageUsage: "Stage Usage", sync: "Synchronization", style: "Style", music: "Musicality", comp: "Composition" };

  const judgeRolesList = [
    'All-in-One', 
    'Tech Judge 1', 'Tech Judge 2', 'Tech Judge 3', 
    'Perf Judge 1', 'Perf Judge 2'
  ];

  // --- Scoring Helpers ---
  const getTechSum = (tech, isTeam) => {
    const labels = isTeam ? teamTechLabels : soloTechLabels;
    const weights = isTeam ? data.teamWeights : data.weights;
    return Object.keys(labels).reduce((acc, key) => acc + ((tech[key] || 0) * (weights[key] || 1)), 0);
  };
  
  const getPerfSum = (perf, isTeam) => {
    const labels = isTeam ? teamPerfLabels : soloPerfLabels;
    return Object.keys(labels).reduce((acc, key) => acc + parseFloat(perf[key] || 0), 0);
  };
  
  const getDeductionSum = (ded) => (ded.minor * 0.5) + (ded.normal * 1.0) + (ded.major * 3.0);

  // Calculates the display total based on the judge's role
  const calculateLocalTotal = (tech, perf, ded, isTeam, role) => {
    const t = getTechSum(tech, isTeam);
    const p = getPerfSum(perf, isTeam);
    const d = getDeductionSum(ded);
    
    if (role.includes('Tech')) return (t - d).toFixed(2);
    if (role.includes('Perf')) return p.toFixed(2);
    
    // All-in-One
    const techMult = isTeam ? 0.6 : 0.7;
    const perfMult = isTeam ? 0.4 : 0.3;
    return ((t * techMult) + (p * perfMult) - d).toFixed(2);
  };

  // --- Auth Handlers ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginUser === 'awooga' && loginPass === '123') {
      setIsAuthenticated(true);
      sessionStorage.setItem('auth_token', 'valid');
      setLoginError('');
    } else {
      setLoginError('Invalid Username or Password');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('auth_token');
    setLoginUser('');
    setLoginPass('');
  };

  // --- Core Actions ---
  const addCompetitor = (e) => {
    e.preventDefault();
    if (!currentCompetitorName.trim()) return;
    const newCompetitor = {
      id: Date.now(),
      name: currentCompetitorName,
      division: currentDivision,
      technical: { oneD: 0, twoD: 0, threeD: 0, fourD: 0, vertax: 0, team1D: 0, team2D: 0, team3D: 0, teamVertax: 0, teamLong: 0 },
      performance: { stage: 0, style: 0, control: 0, music: 0, comp: 0, stageUsage: 0, sync: 0 },
      deductions: { minor: 0, normal: 0, major: 0 },
      totalScore: 0,
      isJudged: false
    };
    setData(prev => ({ ...prev, competitors: [...prev.competitors, newCompetitor] }));
    setCurrentCompetitorName('');
  };

  const startJudging = (competitor) => {
    setJudgeSelection(competitor);
    
    // Auto-route tabs based on role
    if (data.judgeRole.includes('Perf')) setJudgeTab('perf');
    else setJudgeTab('tech');

    setCurrentScores({
      technical: { ...competitor.technical },
      performance: { ...competitor.performance },
      deductions: { ...competitor.deductions }
    });
    setView('judge');
  };

  const handleScoreChange = (type, category, value) => {
    let val = parseFloat(value);
    if (isNaN(val)) val = 0; if (val > 10) val = 10; if (val < 0) val = 0;
    setCurrentScores(prev => ({ ...prev, [type]: { ...prev[type], [category]: val } }));
  };

  const handleDeductionChange = (type, delta) => {
    setCurrentScores(prev => ({
      ...prev,
      deductions: { ...prev.deductions, [type]: Math.max(0, prev.deductions[type] + delta) }
    }));
  };

  const submitScore = () => {
    const isTeam = judgeSelection.division === 'Teams';
    // Local total is just for the current tablet's display
    const finalTotal = calculateLocalTotal(currentScores.technical, currentScores.performance, currentScores.deductions, isTeam, data.judgeRole);
    
    setData(prev => ({
      ...prev,
      competitors: prev.competitors.map(c => c.id === judgeSelection.id ? { 
        ...c, 
        technical: currentScores.technical, 
        performance: currentScores.performance, 
        deductions: currentScores.deductions, 
        totalScore: finalTotal, 
        isJudged: true 
      } : c)
    }));
    setJudgeSelection(null);
    setView('results');
  };

  const updateWeight = (key, val, isTeam = false) => {
    setData(prev => {
      if (isTeam) return { ...prev, teamWeights: { ...prev.teamWeights, [key]: parseFloat(val) || 0 } };
      return { ...prev, weights: { ...prev.weights, [key]: parseFloat(val) || 0 } };
    });
  };

  const updateJudgeRole = (e) => {
    const newRole = e.target.value;
    setData(prev => ({ ...prev, judgeRole: newRole }));
  };

  const handleReset = () => {
    if (window.confirm("ARE YOU SURE? This will delete all competitors and scores permanently.")) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  // --- CSV Export ---
  const exportCSV = () => {
    if (data.competitors.length === 0) return;
    
    // Added Judge Role column
    let csv = 'Judge Role,Rank,Name,Division,Local Score,Ded Total,Minor(-0.5),Normal(-1),Major(-3),';
    csv += Object.values(soloTechLabels).join(',') + ',' + Object.values(teamTechLabels).join(',') + ',Tech Total,';
    csv += Object.values(soloPerfLabels).join(',') + ',' + Object.values(teamPerfLabels).join(',') + ',Perf Total\n';
    
    const sorted = [...data.competitors].sort((a, b) => b.totalScore - a.totalScore);
    sorted.forEach((comp, index) => {
      const isTeam = comp.division === 'Teams';
      const techSum = getTechSum(comp.technical, isTeam).toFixed(2);
      const perfSum = getPerfSum(comp.performance, isTeam).toFixed(2);
      const dedSum = getDeductionSum(comp.deductions).toFixed(1);
      
      let row = `"${data.judgeRole}",${index + 1},"${comp.name}","${comp.division}",${comp.totalScore},${dedSum},`;
      row += `${comp.deductions.minor},${comp.deductions.normal},${comp.deductions.major},`;
      
      row += Object.keys(soloTechLabels).map(k => comp.technical[k] || 0).join(',') + ',';
      row += Object.keys(teamTechLabels).map(k => comp.technical[k] || 0).join(',') + ',';
      row += `${techSum},`; 

      row += Object.keys(soloPerfLabels).map(k => comp.performance[k] || 0).join(',') + ',';
      row += Object.keys(teamPerfLabels).map(k => comp.performance[k] || 0).join(',') + ',';
      row += `${perfSum}`; 
      
      csv += row + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; 
    
    // Name the file based on the judge role
    const safeRoleName = data.judgeRole.replace(/\s+/g, '_').toLowerCase();
    a.download = `${safeRoleName}_results.csv`;
    
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // --- MASTER COMPILER LOGIC ---
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles(files.map(f => f.name));
    
    const readers = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.readAsText(file);
      });
    });

    Promise.all(readers).then(contents => {
      processMasterResults(contents);
    });
  };

  const processMasterResults = (csvContents) => {
    const aggregated = {};

    csvContents.forEach(csv => {
      const rows = csv.split('\n');
      const headers = rows[0].split(',');
      
      const roleIdx = headers.indexOf('Judge Role');
      const nameIdx = headers.indexOf('Name');
      const divIdx = headers.indexOf('Division');
      const techTotalIdx = headers.indexOf('Tech Total');
      const perfTotalIdx = headers.indexOf('Perf Total');
      const dedTotalIdx = headers.indexOf('Ded Total');

      rows.slice(1).forEach(rowStr => {
        if (!rowStr.trim()) return;
        const row = rowStr.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        
        const role = row[roleIdx]?.replace(/"/g, '').trim() || 'Unknown';
        const name = row[nameIdx]?.replace(/"/g, '').trim();
        const division = row[divIdx]?.replace(/"/g, '').trim();
        
        if (!name) return;

        const key = `${name}-${division}`;
        if (!aggregated[key]) {
          aggregated[key] = { name, division, techTotals: [], perfTotals: [], dedTotals: [] };
        }

        // Only pull Tech/Ded scores if the judge was a Tech Judge or All-in-One
        if (role.includes('Tech') || role === 'All-in-One') {
          aggregated[key].techTotals.push(parseFloat(row[techTotalIdx]) || 0);
          aggregated[key].dedTotals.push(parseFloat(row[dedTotalIdx]) || 0);
        }
        
        // Only pull Perf scores if the judge was a Perf Judge or All-in-One
        if (role.includes('Perf') || role === 'All-in-One') {
          aggregated[key].perfTotals.push(parseFloat(row[perfTotalIdx]) || 0);
        }
      });
    });

    const finalResults = Object.values(aggregated).map(comp => {
      // Calculate averages based on how many judges actually submitted that category
      const avgTech = comp.techTotals.length ? comp.techTotals.reduce((a, b) => a + b, 0) / comp.techTotals.length : 0;
      const avgPerf = comp.perfTotals.length ? comp.perfTotals.reduce((a, b) => a + b, 0) / comp.perfTotals.length : 0;
      const avgDed = comp.dedTotals.length ? comp.dedTotals.reduce((a, b) => a + b, 0) / comp.dedTotals.length : 0;

      const isTeam = comp.division === 'Teams';
      const techMult = isTeam ? 0.6 : 0.7;
      const perfMult = isTeam ? 0.4 : 0.3;

      const finalScore = (avgTech * techMult) + (avgPerf * perfMult) - avgDed;

      return {
        ...comp,
        avgTech: avgTech.toFixed(2),
        avgPerf: avgPerf.toFixed(2),
        avgDed: avgDed.toFixed(2),
        finalScore: finalScore.toFixed(2),
        techJudgesCount: comp.techTotals.length,
        perfJudgesCount: comp.perfTotals.length
      };
    });

    setMasterResults(finalResults);
  };

  const filteredCompetitors = data.competitors.filter(c => c.division === currentDivision);
  const filteredMaster = masterResults.filter(c => c.division === currentDivision);

  // --- RENDER ---
  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>Texas Diabolo <span>2026</span></h1>
          <form onSubmit={handleLogin}>
            <input type="text" placeholder="Username" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} />
            <input type="password" placeholder="Password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
            {loginError && <div className="error-msg">{loginError}</div>}
            <button type="submit" className="btn-primary">Access System</button>
          </form>
        </div>
      </div>
    );
  }

  const isJudgingTeam = judgeSelection?.division === 'Teams';
  const activeTechLabels = isJudgingTeam ? teamTechLabels : soloTechLabels;
  const activePerfLabels = isJudgingTeam ? teamPerfLabels : soloPerfLabels;
  const activeWeights = isJudgingTeam ? data.teamWeights : data.weights;

  // Determine what panels to show based on Judge Role
  const showTechPanel = data.judgeRole.includes('Tech') || data.judgeRole === 'All-in-One';
  const showPerfPanel = data.judgeRole.includes('Perf') || data.judgeRole === 'All-in-One';

  return (
    <div className="app-container">
      <header className="main-header">
        <div className="header-content">
          <h1>Texas Diabolo <span>2026</span></h1>
          <div className="header-actions">
            <div className="division-selector">
              <select value={currentDivision} onChange={(e) => setCurrentDivision(e.target.value)}>
                {data.divisions.map(div => <option key={div} value={div}>{div}</option>)}
              </select>
            </div>
            <button onClick={handleLogout} className="btn-logout">Logout</button>
          </div>
        </div>
        
        <nav className="main-nav">
          <button onClick={() => setView('register')} className={view === 'register' ? 'active' : ''}>Registration</button>
          <button onClick={() => setView('results')} className={view === 'results' ? 'active' : ''}>Local Scores</button>
          <button onClick={() => setView('analysis')} className={view === 'analysis' ? 'active' : ''}>Analysis</button>
          <button onClick={() => setView('master')} className={view === 'master' ? 'active' : ''}>Master Compiler</button>
          <button onClick={() => setView('settings')} className={view === 'settings' ? 'active' : ''}>Settings</button>
        </nav>
      </header>

      <main>
        {/* SETTINGS */}
        {view === 'settings' && (
          <section className="card settings-card">
            <h2>Configuration</h2>
            
            <div className="setting-block" style={{marginBottom: '20px', background: '#e0e7ff', padding: '15px', borderRadius: '8px'}}>
               <h3 style={{marginTop: 0, color: '#3730a3'}}>Device Judge Role</h3>
               <p style={{fontSize: '0.85rem', color: '#4f46e5', marginBottom: '10px'}}>Set this tablet's role. It restricts which sliders the judge sees and tags the exported CSV correctly for the Master Compiler.</p>
               <select value={data.judgeRole} onChange={updateJudgeRole} style={{padding: '8px', borderRadius: '6px', border: '1px solid #c7d2fe', width: '100%', fontWeight: 'bold'}}>
                 {judgeRolesList.map(role => <option key={role} value={role}>{role}</option>)}
               </select>
            </div>
            
            <div className="setting-block">
              <h3>Solo Technical Weights</h3>
              <div className="settings-grid">
                {Object.keys(data.weights).map(key => (
                  <div key={key} className="weight-input">
                    <label>{soloTechLabels[key]}</label>
                    <input type="number" step="0.1" min="0" value={data.weights[key]} onChange={(e) => updateWeight(key, e.target.value, false)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="setting-block" style={{marginTop: '20px'}}>
              <h3>Team Technical Weights</h3>
              <div className="settings-grid">
                {Object.keys(data.teamWeights).map(key => (
                  <div key={key} className="weight-input">
                    <label>{teamTechLabels[key]}</label>
                    <input type="number" step="0.1" min="0" value={data.teamWeights[key]} onChange={(e) => updateWeight(key, e.target.value, true)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="setting-block danger-zone">
              <button onClick={handleReset} className="btn-danger">Reset All Data</button>
            </div>
          </section>
        )}

        {/* REGISTRATION */}
        {view === 'register' && (
          <section className="card">
            <h2>Registration <span className="division-badge">{currentDivision}</span></h2>
            <form onSubmit={addCompetitor} className="add-form">
              <input type="text" placeholder={currentDivision === 'Teams' ? "Enter Team Name..." : "Enter Competitor Name..."} value={currentCompetitorName} onChange={(e) => setCurrentCompetitorName(e.target.value)} />
              <button type="submit" className="btn-primary">Add {currentDivision === 'Teams' ? 'Team' : 'Competitor'}</button>
            </form>
            <div className="list-group">
              {filteredCompetitors.map(comp => (
                <div key={comp.id} className="competitor-row">
                  <div className="comp-info">
                    <span className="comp-name">{comp.name}</span>
                    {comp.isJudged && <span className="status-badge">Scored: {comp.totalScore}</span>}
                  </div>
                  <button onClick={() => startJudging(comp)} className={`btn-judge ${comp.isJudged ? 'done' : ''}`}>{comp.isJudged ? 'Edit' : 'Judge'}</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* JUDGING */}
        {view === 'judge' && judgeSelection && (
          <section className="card judging-box">
            <div className="judge-header">
              <div className="judge-info">
                <h2>{judgeSelection.name} <span className="division-badge">{judgeSelection.division}</span></h2>
                <div className="pill-tabs">
                  {showTechPanel && (
                    <button className={judgeTab === 'tech' ? 'active' : ''} onClick={() => setJudgeTab('tech')}>
                      Technical ({isJudgingTeam ? '60%' : '70%'})
                    </button>
                  )}
                  {showPerfPanel && (
                    <button className={judgeTab === 'perf' ? 'active' : ''} onClick={() => setJudgeTab('perf')}>
                      Performance ({isJudgingTeam ? '40%' : '30%'})
                    </button>
                  )}
                </div>
              </div>
              <div className="live-score-box">
                <span className="score-label">{data.judgeRole} Score</span>
                <span className="score-val">{calculateLocalTotal(currentScores.technical, currentScores.performance, currentScores.deductions, isJudgingTeam, data.judgeRole)}</span>
              </div>
            </div>
            
            <div className="sliders-container">
              {judgeTab === 'tech' && showTechPanel ? Object.keys(activeTechLabels).map(cat => (
                <div key={cat} className="slider-group">
                  <div className="slider-top">
                    <span className="slider-name">{activeTechLabels[cat]} <span className="weight-badge">x{activeWeights[cat]}</span></span>
                    <input className="manual-score-input" type="number" step="0.1" min="0" max="10" value={currentScores.technical[cat]} onChange={(e) => handleScoreChange('technical', cat, e.target.value)} />
                  </div>
                  <input type="range" min="0" max="10" step="0.1" value={currentScores.technical[cat]} onChange={(e) => handleScoreChange('technical', cat, e.target.value)} />
                </div>
              )) : null}

              {judgeTab === 'perf' && showPerfPanel ? Object.keys(activePerfLabels).map(cat => (
                <div key={cat} className="slider-group">
                  <div className="slider-top">
                    <span className="slider-name">{activePerfLabels[cat]}</span>
                    <input className="manual-score-input" type="number" step="0.1" min="0" max="10" value={currentScores.performance[cat]} onChange={(e) => handleScoreChange('performance', cat, e.target.value)} />
                  </div>
                  <input type="range" min="0" max="10" step="0.1" value={currentScores.performance[cat]} onChange={(e) => handleScoreChange('performance', cat, e.target.value)} />
                </div>
              )) : null}
            </div>
            
            {showTechPanel && (
              <div className="deductions-panel">
                <h3>Deductions</h3>
                <div className="deduction-grid">
                  {[['minor', 0.5], ['normal', 1], ['major', 3]].map(([type, val]) => (
                    <div key={type} className={`deduction-card ${type}`}>
                      <span className="ded-title">{type} (-{val})</span>
                      <div className="stepper">
                        <button onClick={() => handleDeductionChange(type, -1)}>–</button>
                        <span>{currentScores.deductions[type]}</span>
                        <button onClick={() => handleDeductionChange(type, 1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="judge-actions">
              <button onClick={() => setView('register')} className="btn-text">Cancel</button>
              <button onClick={submitScore} className="btn-primary">Confirm Score</button>
            </div>
          </section>
        )}

        {/* LOCAL RESULTS */}
        {view === 'results' && (
          <section className="card results-card">
            <div className="card-header row-between">
              <h2>Local Leaderboard <span className="division-badge">{currentDivision}</span></h2>
              <button onClick={exportCSV} className="btn-secondary">Export Role CSV</button>
            </div>
            <p className="subtext" style={{marginTop: '-10px', marginBottom: '20px'}}>Showing data entered on this device ({data.judgeRole}). Use the Master Compiler to merge all judges.</p>
            <div className="table-responsive">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{currentDivision === 'Teams' ? 'Team' : 'Competitor'}</th>
                    <th>Tech Score</th>
                    <th>Perf Score</th>
                    <th>Ded</th>
                    <th>Local View</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompetitors.sort((a, b) => b.totalScore - a.totalScore).map((comp, index) => {
                     const isTeam = comp.division === 'Teams';
                     const t = getTechSum(comp.technical, isTeam);
                     const p = getPerfSum(comp.performance, isTeam);
                     
                     return (
                      <tr key={comp.id} className={index < 3 ? `rank-${index+1}` : ''}>
                        <td className="rank-col">{index + 1}</td>
                        <td className="name-col">{comp.name}</td>
                        <td className="tech-col">{t.toFixed(2)}</td>
                        <td className="perf-col">{p.toFixed(2)}</td>
                        <td className="drop-col">-{getDeductionSum(comp.deductions)}</td>
                        <td className="final-score">{comp.totalScore}</td>
                      </tr>
                     );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* MASTER COMPILER */}
        {view === 'master' && (
          <section className="card">
            <div className="card-header">
              <h2>Master Results <span className="division-badge">{currentDivision}</span></h2>
            </div>
            
            <div className="upload-area">
              <p>Upload CSV files from <strong>Tech Judges</strong> and <strong>Performance Judges</strong>. The system will average their respective scores based on their roles.</p>
              <input type="file" multiple accept=".csv" onChange={handleFileUpload} className="file-input" />
              <div className="file-list">
                {uploadedFiles.map((f, i) => <span key={i} className="file-tag">{f}</span>)}
              </div>
            </div>

            {masterResults.length > 0 && (
              <div className="table-wrapper mt-4">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Competitor</th>
                      <th>Avg Tech</th>
                      <th>Avg Perf</th>
                      <th>Avg Ded</th>
                      <th>Final Score</th>
                      <th>Stats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaster.sort((a, b) => b.finalScore - a.finalScore).map((comp, index) => (
                      <tr key={index} className={index < 3 ? `rank-${index+1}` : ''}>
                        <td className="rank-col">{index + 1}</td>
                        <td className="name-col">{comp.name}</td>
                        <td className="tech-col">{comp.avgTech}</td>
                        <td className="perf-col">{comp.avgPerf}</td>
                        <td className="drop-col">-{comp.avgDed}</td>
                        <td className="final-score">{comp.finalScore}</td>
                        <td className="muted">({comp.techJudgesCount}T/{comp.perfJudgesCount}P)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ANALYSIS */}
        {view === 'analysis' && (
           <section className="card">
             <div className="card-header row-between">
               <h2>Local Analysis <span className="division-badge">{currentDivision}</span></h2>
               <div className="pill-tabs small">
                 <button className={analysisTab === 'tech' ? 'active' : ''} onClick={() => setAnalysisTab('tech')}>Tech</button>
                 <button className={analysisTab === 'perf' ? 'active' : ''} onClick={() => setAnalysisTab('perf')}>Perf</button>
               </div>
             </div>
             <div className="analysis-grid-layout">
               {filteredCompetitors.length === 0 && <p className="empty-state">No data available.</p>}
               {filteredCompetitors.sort((a, b) => b.totalScore - a.totalScore).map(comp => {
                 const isTeam = comp.division === 'Teams';
                 const renderTechLabels = isTeam ? teamTechLabels : soloTechLabels;
                 const renderPerfLabels = isTeam ? teamPerfLabels : soloPerfLabels;

                 return (
                   <div key={comp.id} className="analysis-block">
                     <div className="block-head">
                       <strong>{comp.name}</strong>
                       <span className="score-tag">{comp.totalScore}</span>
                     </div>
                     <div className="chart-area">
                       {analysisTab === 'tech' ? Object.keys(renderTechLabels).map((key, i) => (
                         <div key={key} className="chart-col">
                           <div className="bar-track">
                             <div className={`bar-fill chart-color-${i+1}`} style={{ height: `${(comp.technical[key]/10)*100}%` }}></div>
                           </div>
                           <span className="chart-label">{renderTechLabels[key]}</span>
                         </div>
                       )) : Object.keys(renderPerfLabels).map(key => (
                         <div key={key} className="chart-col">
                           <div className="bar-track">
                             <div className="bar-fill perf-generic" style={{ height: `${(comp.performance[key]/10)*100}%` }}></div>
                           </div>
                           <span className="chart-label">{renderPerfLabels[key]}</span>
                         </div>
                       ))}
                     </div>
                   </div>
                 );
               })}
             </div>
           </section>
         )}
      </main>
    </div>
  );
}

export default App;