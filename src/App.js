import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const STORAGE_KEY = 'texas-diabolo-2026-v4';

  // --- Initializer ---
  const loadState = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Data migration safety check (if older versions existed)
      const updatedCompetitors = parsed.competitors.map(c => ({
        ...c,
        deductions: c.deductions || { minor: 0, normal: 0, major: 0 }
      }));
      return { ...parsed, competitors: updatedCompetitors };
    }
    return {
      competitors: [],
      divisions: ['Open', 'Regional Open', 'Regional Under 18'],
      weights: { oneD: 1.0, twoD: 1.0, threeD: 1.0, fourD: 1.0, vertax: 1.0 }
    };
  };

  // --- Global State ---
  const [data, setData] = useState(loadState);
  const [view, setView] = useState('register'); 
  const [currentDivision, setCurrentDivision] = useState(data.divisions[0]);
  
  // Tabs
  const [judgeTab, setJudgeTab] = useState('tech'); 
  const [analysisTab, setAnalysisTab] = useState('tech'); 

  const [judgeSelection, setJudgeSelection] = useState(null);
  const [currentCompetitorName, setCurrentCompetitorName] = useState('');
  
  // Judging Holding State
  const [currentScores, setCurrentScores] = useState({
    technical: { oneD: 0, twoD: 0, threeD: 0, fourD: 0, vertax: 0 },
    performance: { stage: 0, style: 0, control: 0, music: 0, comp: 0 },
    deductions: { minor: 0, normal: 0, major: 0 }
  });

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // --- Mappings ---
  const techLabels = { oneD: "1D", twoD: "2D", threeD: "3D", fourD: "4D", vertax: "Vertax" };
  const perfLabels = { stage: "Stage", style: "Style", control: "Control", music: "Musicality", comp: "Composition" };

  // --- Helpers ---
  const getTechSum = (tech) => Object.keys(tech).reduce((acc, key) => acc + (tech[key] * data.weights[key]), 0);
  const getPerfSum = (perf) => Object.values(perf).reduce((acc, val) => acc + parseFloat(val), 0);
  const getDeductionSum = (ded) => (ded.minor * 0.5) + (ded.normal * 1.0) + (ded.major * 3.0);

  const calculateTotal = (tech, perf, ded) => {
    const total = getTechSum(tech) + getPerfSum(perf) - getDeductionSum(ded);
    return total.toFixed(2);
  };

  // --- Actions ---
  const addCompetitor = (e) => {
    e.preventDefault();
    if (!currentCompetitorName.trim()) return;
    
    const newCompetitor = {
      id: Date.now(),
      name: currentCompetitorName,
      division: currentDivision,
      technical: { oneD: 0, twoD: 0, threeD: 0, fourD: 0, vertax: 0 },
      performance: { stage: 0, style: 0, control: 0, music: 0, comp: 0 },
      deductions: { minor: 0, normal: 0, major: 0 },
      totalScore: 0,
      isJudged: false
    };

    setData(prev => ({ ...prev, competitors: [...prev.competitors, newCompetitor] }));
    setCurrentCompetitorName('');
  };

  const startJudging = (competitor) => {
    setJudgeSelection(competitor);
    setJudgeTab('tech');
    setCurrentScores({
      technical: { ...competitor.technical },
      performance: { ...competitor.performance },
      deductions: { ...competitor.deductions }
    });
    setView('judge');
  };

  const handleScoreChange = (type, category, value) => {
    let val = parseFloat(value);
    if (isNaN(val)) val = 0;
    if (val > 10) val = 10;
    if (val < 0) val = 0;

    setCurrentScores(prev => ({
      ...prev,
      [type]: { ...prev[type], [category]: val }
    }));
  };

  const handleDeductionChange = (type, delta) => {
    setCurrentScores(prev => ({
      ...prev,
      deductions: {
        ...prev.deductions,
        [type]: Math.max(0, prev.deductions[type] + delta)
      }
    }));
  };

  const submitScore = () => {
    const finalTotal = calculateTotal(currentScores.technical, currentScores.performance, currentScores.deductions);
    setData(prev => ({
      ...prev,
      competitors: prev.competitors.map(c => 
        c.id === judgeSelection.id 
          ? { ...c, technical: currentScores.technical, performance: currentScores.performance, deductions: currentScores.deductions, totalScore: finalTotal, isJudged: true }
          : c
      )
    }));
    setJudgeSelection(null);
    setView('results');
  };

  const updateWeight = (key, val) => {
    setData(prev => ({ ...prev, weights: { ...prev.weights, [key]: val } }));
  };

  // --- Reset Feature ---
  const handleReset = () => {
    if (window.confirm("ARE YOU SURE? This will delete all competitors and scores permanently.")) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  // --- CSV Export ---
  const exportCSV = () => {
    if (data.competitors.length === 0) return;
    let csv = 'Rank,Name,Division,Total Score,Ded Total,Minor(-0.5),Normal(-1),Major(-3),';
    csv += Object.values(techLabels).join(',') + ',Tech Total,';
    csv += Object.values(perfLabels).join(',') + ',Perf Total\n';

    const sorted = [...data.competitors].sort((a, b) => b.totalScore - a.totalScore);
    sorted.forEach((comp, index) => {
      const techSum = getTechSum(comp.technical).toFixed(2);
      const perfSum = getPerfSum(comp.performance).toFixed(2);
      const dedSum = getDeductionSum(comp.deductions).toFixed(1);
      
      let row = `${index + 1},"${comp.name}","${comp.division}",${comp.totalScore},${dedSum},`;
      row += `${comp.deductions.minor},${comp.deductions.normal},${comp.deductions.major},`;
      row += Object.keys(techLabels).map(k => comp.technical[k]).join(',') + ',';
      row += `${techSum},`;
      row += Object.keys(perfLabels).map(k => comp.performance[k]).join(',') + ',';
      row += `${perfSum}`;
      csv += row + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diabolo_results_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredCompetitors = data.competitors.filter(c => c.division === currentDivision);

  return (
    <div className="app-container">
      <header className="main-header">
        <div className="header-content">
          <h1>Texas Diabolo <span>2026</span></h1>
          <div className="division-selector">
            <select value={currentDivision} onChange={(e) => setCurrentDivision(e.target.value)}>
              {data.divisions.map(div => <option key={div} value={div}>{div}</option>)}
            </select>
          </div>
        </div>
        
        <nav className="main-nav">
          <button onClick={() => setView('register')} className={view === 'register' ? 'active' : ''}>Registration</button>
          <button onClick={() => setView('settings')} className={view === 'settings' ? 'active' : ''}>Settings</button>
          <button onClick={() => setView('results')} className={view === 'results' ? 'active' : ''}>Results</button>
          <button onClick={() => setView('analysis')} className={view === 'analysis' ? 'active' : ''}>Analysis</button>
        </nav>
      </header>

      <main>
        {view === 'settings' && (
          <section className="card settings-card">
            <div className="card-header">
              <h2>Configuration</h2>
            </div>
            <div className="setting-block">
              <h3>Technical Scoring Weights</h3>
              <p className="subtext">Adjust multipliers for difficulty.</p>
              <div className="settings-grid">
                {Object.keys(data.weights).map(key => (
                  <div key={key} className="weight-input">
                    <label>{techLabels[key]}</label>
                    <input type="number" step="0.1" min="0" value={data.weights[key]} onChange={(e) => updateWeight(key, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="setting-block danger-zone">
              <h3>Danger Zone</h3>
              <p>Resetting will permanently delete all competitor data.</p>
              <button onClick={handleReset} className="btn-danger">Reset All Data</button>
            </div>
          </section>
        )}

        {view === 'register' && (
          <section className="card">
            <div className="card-header">
              <h2>Registration <span className="division-badge">{currentDivision}</span></h2>
            </div>
            <form onSubmit={addCompetitor} className="add-form">
              <input type="text" placeholder="Enter Competitor Name..." value={currentCompetitorName} onChange={(e) => setCurrentCompetitorName(e.target.value)} />
              <button type="submit" className="btn-primary">Add Competitor</button>
            </form>
            <div className="list-group">
              {filteredCompetitors.length === 0 && <p className="empty-state">No competitors registered yet.</p>}
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

        {view === 'judge' && judgeSelection && (
          <section className="card judging-box">
            <div className="judge-header">
              <div className="judge-info">
                <h2>{judgeSelection.name}</h2>
                <div className="pill-tabs">
                  <button className={judgeTab === 'tech' ? 'active' : ''} onClick={() => setJudgeTab('tech')}>Technical</button>
                  <button className={judgeTab === 'perf' ? 'active' : ''} onClick={() => setJudgeTab('perf')}>Performance</button>
                </div>
              </div>
              <div className="live-score-box">
                <span className="score-label">Live Score</span>
                <span className="score-val">{calculateTotal(currentScores.technical, currentScores.performance, currentScores.deductions)}</span>
              </div>
            </div>
            
            <div className="sliders-container">
              {judgeTab === 'tech' ? Object.keys(currentScores.technical).map(cat => (
                <div key={cat} className="slider-group">
                  <div className="slider-top">
                    <span className="slider-name">{techLabels[cat]} <span className="weight-badge">x{data.weights[cat]}</span></span>
                    <input className="manual-score-input" type="number" step="0.1" min="0" max="10" value={currentScores.technical[cat]} onChange={(e) => handleScoreChange('technical', cat, e.target.value)} />
                  </div>
                  <input type="range" min="0" max="10" step="0.1" value={currentScores.technical[cat]} onChange={(e) => handleScoreChange('technical', cat, e.target.value)} />
                </div>
              )) : Object.keys(currentScores.performance).map(cat => (
                <div key={cat} className="slider-group">
                  <div className="slider-top">
                    <span className="slider-name">{perfLabels[cat]}</span>
                    <input className="manual-score-input" type="number" step="0.1" min="0" max="10" value={currentScores.performance[cat]} onChange={(e) => handleScoreChange('performance', cat, e.target.value)} />
                  </div>
                  <input type="range" min="0" max="10" step="0.1" value={currentScores.performance[cat]} onChange={(e) => handleScoreChange('performance', cat, e.target.value)} />
                </div>
              ))}
            </div>

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

            <div className="judge-actions">
              <button onClick={() => setView('register')} className="btn-text">Cancel</button>
              <button onClick={submitScore} className="btn-primary">Confirm Score</button>
            </div>
          </section>
        )}

        {view === 'results' && (
          <section className="card results-card">
            <div className="card-header row-between">
              <h2>Leaderboard <span className="division-badge">{currentDivision}</span></h2>
              <button onClick={exportCSV} className="btn-secondary">Download CSV</button>
            </div>
            <div className="table-wrapper">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Competitor</th>
                    <th>Tech</th>
                    <th>Perf</th>
                    <th>Ded</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompetitors.sort((a, b) => b.totalScore - a.totalScore).map((comp, index) => (
                    <tr key={comp.id} className={index < 3 ? `rank-${index+1}` : ''}>
                      <td className="rank-col">{index + 1}</td>
                      <td className="name-col">{comp.name}</td>
                      <td className="tech-col">{getTechSum(comp.technical).toFixed(2)}</td>
                      <td className="perf-col">{getPerfSum(comp.performance).toFixed(2)}</td>
                      <td className="drop-col">-{getDeductionSum(comp.deductions)}</td>
                      <td className="final-score">{comp.totalScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {view === 'analysis' && (
          <section className="card">
            <div className="card-header row-between">
              <h2>Analysis <span className="division-badge">{currentDivision}</span></h2>
              <div className="pill-tabs small">
                <button className={analysisTab === 'tech' ? 'active' : ''} onClick={() => setAnalysisTab('tech')}>Tech</button>
                <button className={analysisTab === 'perf' ? 'active' : ''} onClick={() => setAnalysisTab('perf')}>Perf</button>
              </div>
            </div>
            <div className="analysis-grid-layout">
              {filteredCompetitors.length === 0 && <p className="empty-state">No data available.</p>}
              {filteredCompetitors.sort((a, b) => b.totalScore - a.totalScore).map(comp => (
                <div key={comp.id} className="analysis-block">
                  <div className="block-head">
                    <strong>{comp.name}</strong>
                    <span className="score-tag">{comp.totalScore}</span>
                  </div>
                  <div className="chart-area">
                    {analysisTab === 'tech' ? Object.keys(techLabels).map(key => (
                      <div key={key} className="chart-col">
                        <div className="bar-track">
                          <div className={`bar-fill cat-${key}`} style={{ height: `${(comp.technical[key]/10)*100}%` }}></div>
                        </div>
                        <span className="chart-label">{techLabels[key]}</span>
                      </div>
                    )) : Object.keys(perfLabels).map(key => (
                      <div key={key} className="chart-col">
                        <div className="bar-track">
                          <div className="bar-fill perf-generic" style={{ height: `${(comp.performance[key]/10)*100}%` }}></div>
                        </div>
                        <span className="chart-label">{perfLabels[key]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;