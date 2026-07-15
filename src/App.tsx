import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Settings, BookOpen, User, RotateCcw, Home, Plus, X, Lock, Play, CheckCircle, List, Upload, Gamepad, LayoutDashboard, LogOut, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import { pinyin } from 'pinyin-pro';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import html2pdf from 'html2pdf.js';


export type Subject = 'chinese' | 'math' | 'science' | 'social_studies' | 'ket';

export const SUBJECT_LABELS: Record<Subject, string> = {
  chinese: '國語',
  math: '數學',
  science: '自然',
  social_studies: '社會',
  ket: 'KET 英文'
};

export interface Question {
  id: string;
  subject: Subject;
  unit: number;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'multiple_choice' | 'fill_in_the_blank';
  prompt: string; // The question text
  options?: string[]; // For multiple choice
  correctAnswer: string; // The exact answer text
  clue?: string; // Optional hint
  createdAt: number;
}

export interface Task {
  id: string;
  title: string;
  subject: Subject;
  targetUnits: number[]; // e.g. [1, 2, 3]
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  questionCount: number;
  isActive: boolean;
  createdAt: number;
}

export interface Attempt {
  id: string;
  taskId: string;
  userId: string;
  userDisplayName: string;
  subject: Subject;
  score: number;
  accuracy: number;
  timeTaken: number;
  wrongQuestionIds: string[];
  timestamp: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'player';
}

export interface SubjectConfig {
  id: Subject;
  totalUnits: number;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "ket-training-9b88d.firebaseapp.com",
  projectId: "ket-training-9b88d",
  storageBucket: "ket-training-9b88d.firebasestorage.app",
  messagingSenderId: "1048640604545",
  appId: "1:1048640604545:web:97763f7dec221ca9eac080"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();




export function AdminDashboard() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl w-full mx-auto py-10 space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-white">總指揮中心</h2>
          <p className="text-gray-400 mt-1">管理各科任務與題庫</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(Object.entries(SUBJECT_LABELS) as [Subject, string][]).map(([id, label]) => (
          <div 
            key={id}
            onClick={() => navigate(`/admin/${id}`)}
            className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 cursor-pointer hover:border-purple-500/50 transition-all group"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">{label}</h3>
              <div className="bg-purple-900/50 text-purple-300 p-2 rounded-xl">
                <BookOpen size={20} />
              </div>
            </div>
            <p className="text-sm text-gray-500">管理 {label} 的題庫、任務配置與檢視學生成績。</p>
          </div>
        ))}
      </div>
    </div>
  );
}


export function AdminSubjectView() {
  const { subjectId } = useParams<{ subjectId: Subject }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tasks' | 'questions' | 'import' | 'settings' | 'attempts' | 'paper'>('tasks');
  const [loading, setLoading] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [config, setConfig] = useState<SubjectConfig>({ id: subjectId!, totalUnits: 10 });

  useEffect(() => {
    if (!subjectId) return;
    fetchData();
  }, [subjectId, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'tasks') {
        const snap = await getDocs(query(collection(db, 'tasks'), where('subject', '==', subjectId)));
        setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
        const qSnap = await getDocs(query(collection(db, 'questions'), where('subject', '==', subjectId)));
        setQuestions(qSnap.docs.map(d => ({ id: d.id, ...d.data() } as Question)));
      } else if (activeTab === 'questions') {
        const snap = await getDocs(query(collection(db, 'questions'), where('subject', '==', subjectId)));
        setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Question)));
      } else if (activeTab === 'attempts') {
        const snap = await getDocs(query(collection(db, 'attempts'), where('subject', '==', subjectId)));
        setAttempts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Attempt)));
        const qSnap = await getDocs(query(collection(db, 'questions'), where('subject', '==', subjectId)));
        setQuestions(qSnap.docs.map(d => ({ id: d.id, ...d.data() } as Question)));
        const tSnap = await getDocs(query(collection(db, 'tasks'), where('subject', '==', subjectId)));
        setTasks(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      } else if (activeTab === 'settings') {
        const snap = await getDocs(query(collection(db, 'configs'), where('id', '==', subjectId)));
        if (!snap.empty) {
          setConfig(snap.docs[0].data() as SubjectConfig);
        }
      }
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (!subjectId) return null;

  return (
    <div className="max-w-6xl w-full mx-auto py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-white">{SUBJECT_LABELS[subjectId]} 管理中心</h2>
        </div>
        <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-white">
          返回總覽
        </button>
      </div>

      <div className="flex space-x-2 border-b border-gray-800 overflow-x-auto pb-2">
        <Tab btnTab="tasks" current={activeTab} set={setActiveTab as any} label="任務管理" icon={<List size={16} />} />
        <Tab btnTab="questions" current={activeTab} set={setActiveTab as any} label="題庫一覽" icon={<BookOpen size={16} />} />
        <Tab btnTab="import" current={activeTab} set={setActiveTab as any} label="匯入題庫" icon={<Upload size={16} />} />
        <Tab btnTab="attempts" current={activeTab} set={setActiveTab as any} label="作答數據" icon={<CheckCircle size={16} />} />
        <Tab btnTab="paper" current={activeTab} set={setActiveTab as any} label="紙本測驗" icon={<Printer size={16} />} />
        <Tab btnTab="settings" current={activeTab} set={setActiveTab as any} label="科目設定" icon={<Settings size={16} />} />
      </div>

      <div className="bg-gray-900/40 rounded-3xl p-6 border border-gray-800">
        {loading ? <p className="text-gray-500">載入中...</p> : (
          <>
            {activeTab === 'tasks' && <TasksTab tasks={tasks} subjectId={subjectId} onRefresh={fetchData} config={config} questions={questions} />}
            {activeTab === 'questions' && <QuestionsTab questions={questions} onRefresh={fetchData} subjectId={subjectId} />}
            {activeTab === 'import' && <ImportTab subjectId={subjectId} config={config} />}
            {activeTab === 'attempts' && <AttemptsTab attempts={attempts} questions={questions} tasks={tasks} />}
            {activeTab === 'paper' && <PaperTestTab questions={questions} attempts={attempts} subjectId={subjectId} />}
            {activeTab === 'settings' && <SettingsTab config={config} subjectId={subjectId} />}
          </>
        )}
      </div>
    </div>
  );
}

function Tab({ btnTab, current, set, label, icon }: any) {
  return (
    <button 
      onClick={() => set(btnTab)}
      className={`px-4 py-3 flex items-center space-x-2 border-b-2 font-bold transition-colors ${current === btnTab ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
    >
      {icon} <span>{label}</span>
    </button>
  );
}


export function TasksTab({ tasks, subjectId, onRefresh, config, questions = [] }: { tasks: Task[], subjectId: Subject, onRefresh: () => void, config: SubjectConfig, questions?: Question[] }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [diff, setDiff] = useState<'easy'|'medium'|'hard'|'mixed'>('mixed');
  const [count, setCount] = useState(10);
  const [units, setUnits] = useState<number[]>([]);

  const availableCount = (() => {
    let availableQuestions = questions;
    if (units.length > 0) {
      availableQuestions = availableQuestions.filter(q => units.includes(q.unit));
    }
    if (diff !== 'mixed') {
      availableQuestions = availableQuestions.filter(q => q.difficulty === diff);
    }
    return availableQuestions.length;
  })();

  const handleCreate = async () => {
    if (count > availableCount) {
      alert(`錯誤：發布的任務題數 (${count}) 大於圖庫中符合條件的題數 (${availableCount})。請調整題數。`);
      return;
    }

    try {
      await addDoc(collection(db, 'tasks'), {
        title, subject: subjectId, targetUnits: units, difficulty: diff, questionCount: count, isActive: true, createdAt: Date.now()
      });
      setShowForm(false);
      onRefresh();
    } catch(e) { console.error(e); }
  };

  const toggleUnit = (u: number) => {
    if (units.includes(u)) setUnits(units.filter(x => x !== u));
    else setUnits([...units, u]);
  };

  const toggleTaskActive = async (t: Task) => {
    await updateDoc(doc(db, 'tasks', t.id), { isActive: !t.isActive });
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-white">任務列表</h3>
        <button onClick={() => setShowForm(!showForm)} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg text-white font-bold text-sm">
          {showForm ? '取消' : '新增任務'}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-800 p-6 rounded-2xl space-y-4">
          <input type="text" placeholder="任務標題 (e.g. 第一次段考模擬)" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white" />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1">
              <select value={diff} onChange={e => setDiff(e.target.value as any)} className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white">
                <option value="mixed">混合難度</option><option value="easy">簡單</option><option value="medium">中等</option><option value="hard">困難</option>
              </select>
              <span className="text-xs text-purple-400">符合條件的題庫數量: {availableCount} 題</span>
            </div>
            <input type="number" placeholder="題數" value={count || ''} onChange={e => setCount(parseInt(e.target.value) || 0)} className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white h-[42px]" />
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-2">選擇範圍 (單元): {units.length === 0 ? '全部' : units.join(', ')}</p>
            <div className="flex flex-wrap gap-2">
              {Array.from({length: config.totalUnits || 10}).map((_, i) => (
                <button key={i+1} onClick={() => toggleUnit(i+1)} className={`px-3 py-1 rounded-lg text-sm ${units.includes(i+1) ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`}>單元 {i+1}</button>
              ))}
            </div>
          </div>
          <button onClick={handleCreate} className="w-full bg-green-600 hover:bg-green-500 py-2 rounded-lg text-white font-bold">發布任務</button>
        </div>
      )}

      <div className="space-y-3">
        {tasks.map(t => (
          <div key={t.id} className="bg-gray-800/50 border border-gray-700 p-4 rounded-xl flex justify-between items-center">
            <div>
              <p className="font-bold text-white">{t.title} {t.isActive ? <span className="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded ml-2">進行中</span> : <span className="text-xs bg-gray-700 text-gray-400 px-2 py-1 rounded ml-2">已停用</span>}</p>
              <p className="text-xs text-gray-400 mt-1">難度: {t.difficulty} | 題數: {t.questionCount} | 範圍: {t.targetUnits.length ? t.targetUnits.join(',') : '全部'}</p>
            </div>
            <button onClick={() => toggleTaskActive(t)} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-white">
              {t.isActive ? '停用' : '啟用'}
            </button>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-gray-500">目前沒有任務</p>}
      </div>
    </div>
  );
}

export function QuestionsTab({ questions, onRefresh, subjectId }: { questions: Question[], onRefresh?: () => void, subjectId?: string }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editOptions, setEditOptions] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newUnit, setNewUnit] = useState(1);
  const [newDiff, setNewDiff] = useState<'easy'|'medium'|'hard'>('medium');
  const [newType, setNewType] = useState<'multiple_choice'|'fill_in_the_blank'>('multiple_choice');
  const [newPrompt, setNewPrompt] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newOptions, setNewOptions] = useState('');

  const handleDelete = async (id: string) => {
    if (confirm('確定刪除此題目？')) {
      await deleteDoc(doc(db, 'questions', id));
      if (onRefresh) onRefresh();
    }
  };

  const handleEdit = (q: Question) => {
    setEditingId(q.id);
    setEditPrompt(q.prompt);
    setEditAnswer(q.correctAnswer);
    setEditOptions(q.options ? q.options.join(', ') : '');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const opts = editOptions.split(',').map(s => s.trim()).filter(s => s);
    await updateDoc(doc(db, 'questions', editingId), {
      prompt: editPrompt,
      correctAnswer: editAnswer,
      options: opts.length > 0 ? opts : null
    });
    setEditingId(null);
    if (onRefresh) onRefresh();
  };

  const handleAdd = async () => {
    if (!subjectId) return alert('缺少科目資訊');
    if (!newPrompt || !newAnswer) return alert('請填寫題目與答案');
    const opts = newOptions.split(',').map(s => s.trim()).filter(s => s);
    
    await addDoc(collection(db, 'questions'), {
      subject: subjectId,
      unit: newUnit,
      difficulty: newDiff,
      type: newType,
      prompt: newPrompt,
      correctAnswer: newAnswer,
      options: opts.length > 0 ? opts : null,
      createdAt: Date.now()
    });
    setShowAddForm(false);
    setNewPrompt('');
    setNewAnswer('');
    setNewOptions('');
    if (onRefresh) onRefresh();
  };

  const exportQuestions = (format: 'pdf' | 'docx') => {
    if (questions.length === 0) return alert('沒有題庫資料');
    let html = `<div style="text-align:center; margin-bottom:20px;"><h2 style="color:#4b5563; font-size:24px;">題庫總覽</h2><p style="color:#6b7280; font-size:14px;">產出時間：${new Date().toLocaleString('zh-TW')} | 共計：${questions.length} 題</p></div>`;
    
    html += `<table style="width:100%; border-collapse:collapse; font-size:13px; table-layout:fixed;">
      <thead>
        <tr style="background-color:#e0e7ff; color:#3730a3; text-align:center;">
          <th style="padding:8px; border:1px solid #a5b4fc; width:15%;">單元</th>
          <th style="padding:8px; border:1px solid #a5b4fc; width:45%;">題目</th>
          <th style="padding:8px; border:1px solid #a5b4fc; width:40%;">正確答案</th>
        </tr>
      </thead>
      <tbody>`;

    for (const q of [...questions].sort((a, b) => a.unit - b.unit)) {
      html += `<tr>
        <td style="padding:8px; border:1px solid #a5b4fc; text-align:center; font-weight:bold; color:#4338ca;">Unit ${q.unit}</td>
        <td style="padding:8px; border:1px solid #a5b4fc; color:#000000;">${q.prompt}</td>
        <td style="padding:8px; border:1px solid #a5b4fc; color:#4b5563;">${q.correctAnswer}</td>
      </tr>`;
    }
    html += `</tbody></table>`;

    if (format === 'docx') {
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent("<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>題庫表</title><style>body{font-family:'Microsoft JhengHei',sans-serif;}</style></head><body>" + html + "</body></html>");
      const link = document.createElement("a"); link.href = source; link.download = `題庫表_${Date.now()}.doc`; link.click();
    } else {
      const opt: any = { margin: 10, filename: `題庫表_${Date.now()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
      const element = document.createElement('div');
      element.innerHTML = `<div style="font-family:'Microsoft JhengHei',sans-serif; padding:10px; color:#000000;">${html}</div>`;
      html2pdf().set(opt).from(element).save();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">題庫一覽 ({questions.length} 題)</h3>
        <div className="flex space-x-2">
          <button onClick={() => setShowAddForm(!showAddForm)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-sm font-bold transition-all"><Plus size={16} className="inline mr-1"/>新增題目</button>
          <button onClick={() => exportQuestions('pdf')} className="bg-red-500/10 hover:bg-red-500/30 text-red-400 border border-red-500/20 px-3 py-1.5 rounded text-sm font-bold transition-all" title="匯出成 PDF">匯出 PDF</button>
          <button onClick={() => exportQuestions('docx')} className="bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded text-sm font-bold transition-all" title="匯出成 DOCX">匯出 DOCX</button>
        </div>
      </div>

      {showAddForm && (
        <div className="bg-gray-800 border border-purple-500/50 p-4 rounded-xl space-y-3 mb-4">
          <h4 className="text-white font-bold mb-2">手動新增題目</h4>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-400">單元</label><input type="number" value={newUnit} onChange={e => setNewUnit(parseInt(e.target.value) || 1)} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white" /></div>
            <div><label className="text-xs text-gray-400">難度</label><select value={newDiff} onChange={e => setNewDiff(e.target.value as any)} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"><option value="easy">簡單</option><option value="medium">中等</option><option value="hard">困難</option></select></div>
            <div><label className="text-xs text-gray-400">題型</label><select value={newType} onChange={e => setNewType(e.target.value as any)} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"><option value="multiple_choice">選擇題</option><option value="fill_in_the_blank">填空題</option></select></div>
          </div>
          <div><label className="text-xs text-gray-400">題目內容</label><input value={newPrompt} onChange={e => setNewPrompt(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white" placeholder="輸入題目..." /></div>
          <div><label className="text-xs text-gray-400">正確答案</label><input value={newAnswer} onChange={e => setNewAnswer(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white" placeholder="輸入正確答案..." /></div>
          {newType === 'multiple_choice' && (
            <div><label className="text-xs text-gray-400">選項 (用逗號 , 分隔)</label><input value={newOptions} onChange={e => setNewOptions(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white" placeholder="選項A, 選項B, 選項C, 選項D" /></div>
          )}
          <div className="flex justify-end space-x-2 pt-2">
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-white px-3 py-1">取消</button>
            <button onClick={handleAdd} className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-lg">確認新增</button>
          </div>
        </div>
      )}

      <div className="max-h-[500px] overflow-y-auto pr-2 space-y-2">
        {questions.map(q => (
          <div key={q.id} className="bg-gray-800/50 border border-gray-700 p-4 rounded-xl text-sm relative group">
            {editingId === q.id ? (
              <div className="space-y-3">
                <div><label className="text-xs text-gray-400">題目</label><input value={editPrompt} onChange={e => setEditPrompt(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white" placeholder="題目內容" /></div>
                <div><label className="text-xs text-gray-400">正確答案</label><input value={editAnswer} onChange={e => setEditAnswer(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white" placeholder="正確答案" /></div>
                {q.type === 'multiple_choice' && (
                  <div><label className="text-xs text-gray-400">選項 (逗號分隔)</label><input value={editOptions} onChange={e => setEditOptions(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white" placeholder="選項1, 選項2, ..." /></div>
                )}
                <div className="flex justify-end space-x-2">
                  <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white px-3 py-1">取消</button>
                  <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded">儲存</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start">
                  <div className="flex space-x-2 mb-2">
                    <span className="bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded text-xs">單元 {q.unit}</span>
                    <span className="bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded text-xs">{q.difficulty}</span>
                    <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-xs">{q.type === 'multiple_choice' ? '選擇' : '填空'}</span>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-3">
                    <button onClick={() => handleEdit(q)} className="text-blue-400 hover:text-blue-300">編輯</button>
                    <button onClick={() => handleDelete(q.id)} className="text-red-400 hover:text-red-300">刪除</button>
                  </div>
                </div>
                <p className="text-white font-bold">{q.prompt}</p>
                <p className="text-gray-400 mt-1">答案: <span className="text-green-400">{q.correctAnswer}</span></p>
              </>
            )}
          </div>
        ))}
        {questions.length === 0 && <p className="text-gray-500">目前沒有題庫資料</p>}
      </div>
    </div>
  );
}

export function ImportTab({ subjectId, config }: { subjectId: Subject, config: SubjectConfig }) {
  const [isImporting, setIsImporting] = useState(false);
  const [textInput, setTextInput] = useState('');

  const parseRobustJSON = (text: string) => {
    let data = null;
    let cleanedText = text.trim();
    cleanedText = cleanedText.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();

    try {
      data = JSON.parse(cleanedText);
    } catch (e) {
      const startIndexArray = cleanedText.indexOf('[');
      if (startIndexArray !== -1) {
        let endIndex = cleanedText.lastIndexOf(']');
        while (endIndex > startIndexArray) {
          const candidate = cleanedText.substring(startIndexArray, endIndex + 1);
          try {
            data = JSON.parse(candidate);
            break;
          } catch (err) {
            endIndex = cleanedText.lastIndexOf(']', endIndex - 1);
          }
        }
      }
      
      if (!data) {
        const startIndexObj = cleanedText.indexOf('{');
        if (startIndexObj !== -1) {
          let endIndex = cleanedText.lastIndexOf('}');
          while (endIndex > startIndexObj) {
            const candidate = cleanedText.substring(startIndexObj, endIndex + 1);
            try {
              data = JSON.parse(candidate);
              break;
            } catch (err) {
              endIndex = cleanedText.lastIndexOf('}', endIndex - 1);
            }
          }
        }
      }
      
      if (!data) {
        throw new Error('無法解析為有效的 JSON 格式。請確認內容是否正確。');
      }
    }

    if (!Array.isArray(data)) {
        if (typeof data === 'object' && data !== null) {
            data = [data];
        } else {
            throw new Error('JSON 格式錯誤，必須是陣列或單一物件。');
        }
    }
    return data;
  };

  const processData = async (data: any[]) => {
    let count = 0;
    for (const item of data) {
      const prompt = item.prompt || item['題目'] || item.Question;
      const correctAnswer = item.correctAnswer || item['答案'] || item.Answer;
      if (!prompt || !correctAnswer) continue;

      let options = item.options || item['選項'] || item.Options || null;
      if (typeof options === 'string') {
        options = options.split(',').map((s: string) => s.trim());
      }

      let itemUnit = item.unit || item['單元'] || item.Unit || 1;
      let itemDiff = item.difficulty || item['難度'] || item.Difficulty || 'medium';
      let itemType = item.type || item['題型'] || item.Type || 'multiple_choice';
      
      if (itemDiff === '簡單') itemDiff = 'easy';
      if (itemDiff === '中等') itemDiff = 'medium';
      if (itemDiff === '困難') itemDiff = 'hard';
      
      if (itemType === '選擇題') itemType = 'multiple_choice';
      if (itemType === '填空題') itemType = 'fill_in_the_blank';

      await addDoc(collection(db, 'questions'), {
        subject: subjectId,
        unit: parseInt(String(itemUnit)) || 1,
        difficulty: itemDiff,
        type: itemType,
        prompt: String(prompt),
        options: options,
        correctAnswer: String(correctAnswer),
        clue: item.clue || item['提示'] || item.Hint || null,
        createdAt: Date.now()
      } as Omit<Question, 'id'>);
      count++;
    }
    return count;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let count = 0;
      if (extension === 'json') {
        const text = await file.text();
        const data = parseRobustJSON(text);
        count = await processData(data);
      } else if (extension === 'xlsx' || extension === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        count = await processData(data);
      } else {
        throw new Error('不支援的檔案格式，請上傳 JSON 或 Excel (xlsx/xls)。');
      }
      alert(`成功匯入 ${count} 題！`);
    } catch (err: any) {
      alert('匯入失敗: ' + err.message);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleTextImport = async () => {
    if (!textInput.trim()) return;
    setIsImporting(true);
    try {
      const data = parseRobustJSON(textInput);
      const count = await processData(data);
      alert(`成功匯入 ${count} 題！`);
      setTextInput('');
    } catch (err: any) {
      alert('文字匯入失敗: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white mb-2">匯入題庫 (支援 JSON 與 Excel)</h3>
      
      <div className="border-2 border-dashed border-gray-700 hover:border-purple-500 rounded-xl p-8 text-center transition-colors">
        <input type="file" accept=".json, .xlsx, .xls" onChange={handleFileUpload} className="hidden" id="file-upload" disabled={isImporting} />
        <label htmlFor="file-upload" className={`cursor-pointer block ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="text-4xl mb-4">📥</div>
          <p className="text-white font-bold mb-1">{isImporting ? '檔案處理中，請稍候...' : '點擊選擇檔案上傳'}</p>
          <p className="text-gray-400 text-sm">支援 .xlsx, .xls, .json 格式</p>
        </label>
      </div>

      <div className="mt-4">
        <p className="text-sm text-gray-400 mb-2">或直接貼上 JSON 陣列：</p>
        <textarea 
          value={textInput} 
          onChange={e => setTextInput(e.target.value)} 
          disabled={isImporting}
          className="w-full h-32 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white font-mono text-sm mb-2 focus:border-purple-500 focus:outline-none" 
          placeholder="[ { &quot;prompt&quot;: &quot;題目&quot;, &quot;correctAnswer&quot;: &quot;答案&quot;, &quot;options&quot;: [&quot;A&quot;, &quot;B&quot;] } ]"
        ></textarea>
        <button 
          onClick={handleTextImport} 
          disabled={isImporting || !textInput.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 rounded-lg text-white font-bold transition-colors"
        >
          貼上文字匯入
        </button>
      </div>

      <div className="bg-gray-800 p-4 rounded-xl mt-4 text-sm text-gray-400">
        <p className="font-bold text-gray-300 mb-2">Excel 欄位說明 (標題行)：</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><span className="text-purple-300">題目 (必填)</span>: 也可以寫 prompt 或 Question</li>
          <li><span className="text-purple-300">答案 (必填)</span>: 也可以寫 correctAnswer 或 Answer</li>
          <li>選項: 選擇題的選項，請用半形逗號 <code className="bg-gray-700 px-1 rounded">,</code> 分隔</li>
          <li>提示: 也可以寫 clue</li>
          <li>其他可選欄位: 單元、難度 (簡單/中等/困難)、題型 (選擇題/填空題)</li>
        </ul>
      </div>
    </div>
  );
}

export function AttemptsTab({ attempts, questions, tasks }: { attempts: Attempt[], questions: Question[], tasks: Task[] }) {
  const [selectedTask, setSelectedTask] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filteredAttempts = selectedTask === 'all' ? attempts : attempts.filter(a => a.taskId === selectedTask);
  const searchedAttempts = filteredAttempts.filter(a => 
    a.userDisplayName?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => b.timestamp - a.timestamp);

  // Group by student
  const studentStats = filteredAttempts.reduce((acc, att) => {
    if (!acc[att.userId]) {
      acc[att.userId] = { 
        name: att.userDisplayName || '匿名', 
        attemptsCount: 0, 
        bestScore: 0,
        totalScore: 0,
        averageAccuracy: 0,
        totalAccuracy: 0
      };
    }
    acc[att.userId].attemptsCount += 1;
    acc[att.userId].bestScore = Math.max(acc[att.userId].bestScore, att.score);
    acc[att.userId].totalScore += att.score;
    acc[att.userId].totalAccuracy += att.accuracy;
    acc[att.userId].averageAccuracy = Math.round(acc[att.userId].totalAccuracy / acc[att.userId].attemptsCount);
    return acc;
  }, {} as Record<string, any>);

  const studentList = Object.values(studentStats).sort((a, b) => b.bestScore - a.bestScore);
  const activePlayers = Object.keys(studentStats).length;
  const avgScore = filteredAttempts.length > 0 ? Math.round(filteredAttempts.reduce((s, a) => s + a.score, 0) / filteredAttempts.length) : 0;
  const highScore = filteredAttempts.length > 0 ? Math.max(...filteredAttempts.map(a => a.score)) : 0;

  // Find all difficult questions
  const wrongCountMap = filteredAttempts.reduce((acc, att) => {
    att.wrongQuestionIds.forEach(id => {
      acc[id] = (acc[id] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  const wrongQuestionsList = Object.entries(wrongCountMap)
    .map(([qId, count]) => {
      const q = questions.find(x => x.id === qId);
      return { id: qId, count, prompt: q?.prompt || '未知題目', answer: q?.correctAnswer || '' };
    })
    .sort((a, b) => b.count - a.count);

  const chartData = [...filteredAttempts].sort((a, b) => a.timestamp - b.timestamp).map(a => {
    const d = new Date(a.timestamp);
    return {
      name: `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      score: a.score,
      accuracy: a.accuracy
    };
  });

  const exportWrongWords = (format: 'pdf' | 'docx') => {
    if (wrongQuestionsList.length === 0) return alert('沒有錯題紀錄');
    let html = `<div style="text-align:center; margin-bottom:20px;"><h2 style="color:#4b5563; font-size:24px;">錯題頻率彙整表</h2><p style="color:#6b7280; font-size:14px;">產出時間：${new Date().toLocaleString('zh-TW')} | 共計：${wrongQuestionsList.length} 題</p></div>`;
    
    html += `<table style="width:100%; border-collapse:collapse; font-size:13px; table-layout:fixed;">
      <thead>
        <tr style="background-color:#fee2e2; color:#991b1b; text-align:center;">
          <th style="padding:8px; border:1px solid #fca5a5; width:15%;">錯誤次數</th>
          <th style="padding:8px; border:1px solid #fca5a5; width:45%;">題目</th>
          <th style="padding:8px; border:1px solid #fca5a5; width:40%;">正確答案</th>
        </tr>
      </thead>
      <tbody>`;

    for (const item of wrongQuestionsList) {
      html += `<tr>
        <td style="padding:8px; border:1px solid #fca5a5; text-align:center; font-weight:bold; color:#dc2626;">${item.count} 次</td>
        <td style="padding:8px; border:1px solid #fca5a5; color:#000000;">${item.prompt}</td>
        <td style="padding:8px; border:1px solid #fca5a5; color:#4b5563;">${item.answer}</td>
      </tr>`;
    }
    html += `</tbody></table>`;

    if (format === 'docx') {
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent("<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>錯題表</title><style>body{font-family:'Microsoft JhengHei',sans-serif;}</style></head><body>" + html + "</body></html>");
      const link = document.createElement("a"); link.href = source; link.download = `錯題表_${Date.now()}.doc`; link.click();
    } else {
      const opt: any = { margin: 10, filename: `錯題表_${Date.now()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
      const element = document.createElement('div');
      element.innerHTML = `<div style="font-family:'Microsoft JhengHei',sans-serif; padding:10px; color:#000000;">${html}</div>`;
      html2pdf().set(opt).from(element).save();
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-xl font-bold text-white">測驗數據分析</h3>
        <select 
          value={selectedTask} 
          onChange={e => setSelectedTask(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white min-w-[200px]"
        >
          <option value="all">全部任務</option>
          {tasks.map(t => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-5">
          <span className="text-xs text-gray-400">總測驗場次</span>
          <p className="text-3xl font-bold mt-2 text-white">{filteredAttempts.length}</p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-5">
          <span className="text-xs text-gray-400">歷史最高記錄</span>
          <p className="text-3xl font-bold mt-2 text-white">{highScore}</p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-5">
          <span className="text-xs text-gray-400">平均分</span>
          <p className="text-3xl font-bold mt-2 text-white">{avgScore}</p>
        </div>
        <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-5">
          <span className="text-xs text-gray-400">活躍考生人數</span>
          <p className="text-3xl font-bold mt-2 text-white">{activePlayers}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-800/60 border border-gray-700 rounded-3xl p-6">
          <h3 className="font-bold text-gray-200 mb-4">測驗成績變化趨勢圖</h3>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickMargin={10} />
                <YAxis yAxisId="left" stroke="#8b5cf6" fontSize={10} />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} domain={[0, 100]} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', borderRadius: '8px' }} />
                <Line yAxisId="left" type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} name="分數" />
                <Line yAxisId="right" type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} name="答對率 (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-3xl p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-200 flex items-center"><CheckCircle size={18} className="mr-2 text-red-400" /> 常錯題排行</h3>
            <div className="flex space-x-2">
              <button onClick={() => exportWrongWords('pdf')} className="bg-red-500/10 hover:bg-red-500/30 text-red-400 border border-red-500/20 px-2 py-1 rounded text-xs font-bold transition-all" title="匯出成 PDF">PDF</button>
              <button onClick={() => exportWrongWords('docx')} className="bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 border border-blue-500/20 px-2 py-1 rounded text-xs font-bold transition-all" title="匯出成 DOCX">DOCX</button>
            </div>
          </div>
          <div className="space-y-3 overflow-y-auto pr-2 max-h-[250px] flex-grow">
            {wrongQuestionsList.map((wq, idx) => (
              <div key={idx} className="bg-gray-900/40 border border-gray-700 p-3 rounded-xl flex justify-between items-center">
                <div className="flex-1 mr-3">
                  <p className="text-white text-sm line-clamp-2">{wq.prompt}</p>
                  <p className="text-gray-400 text-xs mt-1">答: {wq.answer}</p>
                </div>
                <span className="bg-red-900/50 text-red-400 text-xs px-2 py-1 rounded whitespace-nowrap">錯 {wq.count} 次</span>
              </div>
            ))}
            {wrongQuestionsList.length === 0 && <p className="text-gray-500 text-center py-4">目前沒有錯題紀錄</p>}
          </div>
        </div>
      </div>

      <div className="bg-gray-800/60 border border-gray-700 rounded-3xl p-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4 items-center">
          <h3 className="font-bold text-gray-200">實時答題歷史明細</h3>
          <input type="text" placeholder="搜尋姓名..." value={search} onChange={e => setSearch(e.target.value)} className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-purple-500" />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-gray-700 bg-gray-900/30">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-800/60 text-xs text-gray-400">
              <tr>
                <th className="p-4">日期</th>
                <th className="p-4">姓名</th>
                <th className="p-4">得分</th>
                <th className="p-4">準確度</th>
                <th className="p-4">花費時間</th>
              </tr>
            </thead>
            <tbody>
              {searchedAttempts.map(a => (
                <tr key={a.id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                  <td className="p-4 text-gray-300">{new Date(a.timestamp).toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-4 text-white">{a.userDisplayName}</td>
                  <td className="p-4 text-yellow-400 font-bold">{a.score}</td>
                  <td className="p-4 text-green-400">{a.accuracy}%</td>
                  <td className="p-4 text-gray-400">{Math.floor(a.timeTaken / 1000)} 秒</td>
                </tr>
              ))}
              {searchedAttempts.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-gray-500">沒有找到相符的紀錄</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function PaperTestTab({ questions, attempts, subjectId }: { questions: Question[], attempts: Attempt[], subjectId: string }) {
  const [source, setSource] = useState<'all'|'wrong'>('all');
  const [diff, setDiff] = useState<'easy'|'medium'|'hard'|'mixed'>('mixed');
  const [mcCount, setMcCount] = useState(10);
  const [fibCount, setFibCount] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const wrongQuestionIds = useMemo(() => {
    const ids = new Set<string>();
    attempts.forEach(a => a.wrongQuestionIds.forEach(id => ids.add(id)));
    return ids;
  }, [attempts]);

  const filteredQuestions = useMemo(() => {
    let qs = questions;
    if (source === 'wrong') {
      qs = qs.filter(q => wrongQuestionIds.has(q.id));
    }
    if (diff !== 'mixed') {
      qs = qs.filter(q => q.difficulty === diff);
    }
    return qs;
  }, [questions, source, diff, wrongQuestionIds]);

  const mcQuestions = filteredQuestions.filter((q: Question) => q.type === 'multiple_choice');
  const fibQuestions = filteredQuestions.filter((q: Question) => q.type !== 'multiple_choice');

  const handleAutoSelect = () => {
    const mcSelected = [...mcQuestions].sort(() => 0.5 - Math.random()).slice(0, mcCount);
    const fibSelected = [...fibQuestions].sort(() => 0.5 - Math.random()).slice(0, fibCount);
    const newSelected = new Set([...mcSelected.map(q => q.id), ...fibSelected.map(q => q.id)]);
    setSelectedIds(newSelected);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuestions.map((q: Question) => q.id)));
    }
  };

  const exportPaper = (format: 'pdf' | 'docx') => {
    const selectedQs = questions.filter(q => selectedIds.has(q.id));
    if (selectedQs.length === 0) return alert('請先勾選題目');

    const mcSelected = selectedQs.filter((q: Question) => q.type === 'multiple_choice');
    const fibSelected = selectedQs.filter((q: Question) => q.type !== 'multiple_choice');

    let html = `
      <div style="font-family: 'Microsoft JhengHei', sans-serif; padding: 20px; color: #000;">
        <h1 style="text-align: center; font-size: 28px; margin-bottom: 20px;">${SUBJECT_LABELS[subjectId as Subject] || '測驗'} 試卷</h1>
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 16px;">
          <span>班級：__________ 座號：__________ 姓名：____________________</span>
          <span>得分：__________</span>
        </div>
    `;

    if (mcSelected.length > 0) {
      html += `
        <h2 style="font-size: 20px; margin-top: 20px; margin-bottom: 15px;">一、選擇題（共 ${mcSelected.length} 題）</h2>
        <div style="margin-left: 10px;">
      `;
      mcSelected.forEach((q, i) => {
        html += `<div style="margin-bottom: 15px; page-break-inside: avoid;">`;
        html += `<p style="font-size: 16px; margin: 0 0 8px 0;">${i + 1}. ( &nbsp;&nbsp; ) ${q.prompt}</p>`;
        if (q.options && q.options.length > 0) {
          html += `<div style="display: flex; flex-wrap: wrap; gap: 15px; margin-left: 20px;">`;
          q.options.forEach((opt, oi) => {
            html += `<span style="font-size: 15px;">(${String.fromCharCode(65 + oi)}) ${opt}</span>`;
          });
          html += `</div>`;
        }
        html += `</div>`;
      });
      html += `</div>`;
    }

    if (fibSelected.length > 0) {
      html += `
        <h2 style="font-size: 20px; margin-top: 30px; margin-bottom: 15px;">二、填空與問答題（共 ${fibSelected.length} 題）</h2>
        <div style="margin-left: 10px;">
      `;
      fibSelected.forEach((q, i) => {
        html += `<div style="margin-bottom: 25px; page-break-inside: avoid;">`;
        html += `<p style="font-size: 16px; margin: 0 0 10px 0;">${i + 1}. ${q.prompt}</p>`;
        html += `<div style="border-bottom: 1px solid #000; width: 100%; height: 25px;"></div>`;
        html += `</div>`;
      });
      html += `</div>`;
    }

    // Add Answer Key at the end
    html += `
        <div style="page-break-before: always; margin-top: 40px;">
          <h2 style="font-size: 20px; margin-bottom: 15px; text-align: center;">解答</h2>
    `;
    if (mcSelected.length > 0) {
      html += `<h3 style="font-size: 16px;">一、選擇題</h3><div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;">`;
      mcSelected.forEach((q, i) => {
        const correctIdx = q.options ? q.options.findIndex(o => o === q.correctAnswer) : -1;
        const letter = correctIdx >= 0 ? String.fromCharCode(65 + correctIdx) : q.correctAnswer;
        html += `<span style="font-size: 14px; width: 60px;">${i + 1}. ${letter}</span>`;
      });
      html += `</div>`;
    }
    if (fibSelected.length > 0) {
      html += `<h3 style="font-size: 16px;">二、填空與問答題</h3><div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;">`;
      fibSelected.forEach((q, i) => {
        html += `<span style="font-size: 14px; width: 150px;">${i + 1}. ${q.correctAnswer}</span>`;
      });
      html += `</div>`;
    }
    html += `</div></div>`;

    if (format === 'docx') {
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent("<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>測驗試卷</title><style>body{font-family:'Microsoft JhengHei',sans-serif;}</style></head><body>" + html + "</body></html>");
      const link = document.createElement("a"); link.href = source; link.download = `測驗試卷_${Date.now()}.doc`; link.click();
    } else {
      const opt: any = { margin: 15, filename: `測驗試卷_${Date.now()}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
      const element = document.createElement('div');
      element.innerHTML = html;
      html2pdf().set(opt).from(element).save();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 p-6 rounded-2xl space-y-4">
        <h4 className="font-bold text-white text-lg border-b border-gray-700 pb-2">試卷產生條件設定</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">題目來源</label>
            <select value={source} onChange={e => setSource(e.target.value as any)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white">
              <option value="all">題庫所有題目</option>
              <option value="wrong">學生常錯題目 (錯題集)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">難易度</label>
            <select value={diff} onChange={e => setDiff(e.target.value as any)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white">
              <option value="mixed">混合難度</option>
              <option value="easy">簡單</option>
              <option value="medium">中等</option>
              <option value="hard">困難</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">自動選題 - 選擇題數 (庫存: {mcQuestions.length})</label>
            <input type="number" value={mcCount} onChange={e => setMcCount(parseInt(e.target.value) || 0)} max={mcQuestions.length} min={0} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">自動選題 - 填空題數 (庫存: {fibQuestions.length})</label>
            <input type="number" value={fibCount} onChange={e => setFibCount(parseInt(e.target.value) || 0)} max={fibQuestions.length} min={0} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white" />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button onClick={handleAutoSelect} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-lg">自動隨機選題</button>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-2xl">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold text-white text-lg">預覽與選取題目 (已選: {selectedIds.size})</h4>
          <div className="flex space-x-2">
            <button onClick={() => exportPaper('pdf')} className="bg-red-500/10 hover:bg-red-500/30 text-red-400 border border-red-500/20 px-4 py-2 rounded-lg font-bold transition-all text-sm">匯出 PDF 試卷</button>
            <button onClick={() => exportPaper('docx')} className="bg-blue-500/10 hover:bg-blue-500/30 text-blue-400 border border-blue-500/20 px-4 py-2 rounded-lg font-bold transition-all text-sm">匯出 DOCX 試卷</button>
          </div>
        </div>
        
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="p-3 w-10">
                  <input type="checkbox" checked={selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0} onChange={toggleSelectAll} className="w-4 h-4 accent-purple-500" />
                </th>
                <th className="p-3">題型</th>
                <th className="p-3">難度</th>
                <th className="p-3 w-1/2">題目</th>
                <th className="p-3">答案</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700 max-h-[400px] overflow-y-auto">
              {filteredQuestions.map(q => (
                <tr key={q.id} className="hover:bg-gray-700/50 cursor-pointer" onClick={() => toggleSelect(q.id)}>
                  <td className="p-3">
                    <input type="checkbox" checked={selectedIds.has(q.id)} readOnly className="w-4 h-4 accent-purple-500" />
                  </td>
                  <td className="p-3">{q.type === 'multiple_choice' ? '選擇' : '填空'}</td>
                  <td className="p-3">{q.difficulty}</td>
                  <td className="p-3 truncate max-w-xs">{q.prompt}</td>
                  <td className="p-3 text-green-400">{q.correctAnswer}</td>
                </tr>
              ))}
              {filteredQuestions.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-gray-500">沒有符合條件的題目</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function SettingsTab({ config, subjectId }: { config: SubjectConfig, subjectId: Subject }) {
  const [units, setUnits] = useState(config.totalUnits || 10);
  
  const handleSave = async () => {
    try {
      // Find config doc by id or create
      await setDoc(doc(db, 'configs', subjectId), {
        id: subjectId,
        totalUnits: units
      });
      alert('設定已儲存');
    } catch (e) {
      console.error(e);
      alert('儲存失敗');
    }
  };

  return (
    <div className="space-y-4 max-w-md">
      <h3 className="text-xl font-bold text-white mb-4">科目基本設定</h3>
      <div>
        <label className="block text-sm text-gray-400 mb-2">總單元數/課數</label>
        <input type="number" value={units} onChange={e => setUnits(parseInt(e.target.value))} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white" />
      </div>
      <button onClick={handleSave} className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-lg text-white font-bold">儲存設定</button>
    </div>
  );
}




export function Layout({ children, user }: { children: React.ReactNode, user: UserProfile | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Particle effect
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: {x:number,y:number,size:number,speedX:number,speedY:number,color:string}[] = [];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        speedX: Math.random() * 0.5 - 0.25,
        speedY: Math.random() * 0.5 - 0.25,
        color: `rgba(${Math.floor(Math.random()*100+100)}, ${Math.floor(Math.random()*100+100)}, 255, ${Math.random()*0.5})`
      });
    }

    let animationFrameId: number;
    function animate() {
      if(!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0 || p.x > canvas.width) p.speedX *= -1;
        if (p.y < 0 || p.y > canvas.height) p.speedY *= -1;
      }
      animationFrameId = requestAnimationFrame(animate);
    }
    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleLogout = () => {
    if (user?.uid === 'test-admin-uid') {
      window.location.reload();
    } else {
      signOut(auth).then(() => window.location.reload());
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden selection:bg-purple-500 selection:text-white">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full opacity-40"></canvas>
      </div>

      <header className="border-b border-gray-800/80 bg-gray-900/40 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 p-2 rounded-xl text-white shadow-lg">
              <Gamepad size={20} />
            </div>
            <div>
              <h1 className="font-black text-lg tracking-wider bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                全科星際航行系統
              </h1>
              <p className="text-xs text-gray-400">Quest Analytics Platform</p>
            </div>
          </div>

          {user && (
            <div className="flex items-center space-x-3">
              {user.role === 'admin' && location.pathname !== '/admin' && !location.pathname.startsWith('/admin/') && (
                <button onClick={() => navigate('/admin')} className="bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/50 text-purple-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center">
                  <LayoutDashboard size={14} className="mr-1" /> 控制台
                </button>
              )}
              {location.pathname !== '/select-subject' && (
                <button onClick={() => navigate('/select-subject')} className="bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/50 text-indigo-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center">
                  <Home size={14} className="mr-1" /> 任務大廳
                </button>
              )}
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-200">{user.displayName}</p>
                <p className="text-xs text-purple-400 font-mono uppercase">ROLE: {user.role}</p>
              </div>
              {user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-9 h-9 rounded-full border-2 border-purple-500 bg-gray-800 object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-9 h-9 rounded-full border-2 border-purple-500 bg-gray-800 flex items-center justify-center font-bold text-white uppercase">
                  {user.displayName[0]}
                </div>
              )}
              <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 text-sm p-2 transition-colors" title="登出">
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-grow flex flex-col px-4 py-6 z-10 max-w-7xl w-full mx-auto relative">
        {children}
      </main>
    </div>
  );
}

export function SignIn() {
  const [testCode, setTestCode] = useState('');

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
      alert('登入失敗，請稍後再試。');
    }
  };

  const handleTestSubmit = async () => {
    if (testCode === 'ianw0000') {
      try {
        await signInAnonymously(auth);
      } catch (e: any) {
        console.error(e);
        if (e.code === 'auth/admin-restricted-operation') {
          alert('測試登入失敗：請先至 Firebase Console 啟用「匿名登入 (Anonymous Auth)」功能。');
        } else {
          alert('測試登入失敗。');
        }
      }
    } else {
      alert('無效的測試碼');
    }
  };

  return (
    <div className="max-w-md w-full mx-auto text-center py-10 my-auto">
      <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden neon-border">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl"></div>
        <div className="w-20 h-20 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/20 transform hover:scale-105 transition-transform duration-300">
          <span className="text-4xl">🚀</span>
        </div>
        <h2 className="text-2xl font-black tracking-wide text-white">開啟星際全科冒險</h2>
        <p className="text-sm text-gray-400 mt-2 mb-8">登入後系統將根據身分自動分流至遊戲區或考情管理後台。</p>

        <button 
          onClick={handleLogin}
          className="w-full flex items-center justify-center space-x-3 bg-white hover:bg-gray-100 text-gray-900 font-bold py-3.5 px-6 rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] mb-6"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span>Google 帳號快速登入</span>
        </button>

        <div className="border-t border-gray-800 pt-6 mt-2">
          <p className="text-xs text-gray-500 mb-3">或輸入測試碼進入開發模式</p>
          <div className="flex space-x-2">
            <input 
              type="password" 
              value={testCode}
              onChange={e => setTestCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTestSubmit()}
              placeholder="輸入測試碼" 
              className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-4 py-2 text-sm text-center text-purple-300 focus:outline-none focus:border-purple-500"
            />
            <button 
              onClick={handleTestSubmit}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              進入
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SUBJECT_CONFIGS: { id: Subject; icon: string; color: string }[] = [
  { id: 'chinese', icon: '📝', color: 'from-red-500 to-orange-500' },
  { id: 'math', icon: '📐', color: 'from-blue-500 to-cyan-500' },
  { id: 'science', icon: '🔬', color: 'from-green-500 to-emerald-500' },
  { id: 'social_studies', icon: '🌍', color: 'from-amber-500 to-yellow-500' },
  { id: 'ket', icon: '🔤', color: 'from-purple-500 to-pink-500' }
];

export function SubjectSelect() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl w-full mx-auto py-10">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-black text-white mb-2">選擇探索星系 (科目)</h2>
        <p className="text-gray-400">請選擇你今天要進行任務的科目</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {SUBJECT_CONFIGS.map(subj => (
          <div 
            key={subj.id}
            onClick={() => navigate(`/subject/${subj.id}/tasks`)}
            className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 cursor-pointer hover:border-gray-600 transition-all transform hover:-translate-y-1 hover:shadow-xl group"
          >
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${subj.color} flex items-center justify-center text-3xl mb-4 shadow-lg`}>
              {subj.icon}
            </div>
            <h3 className="text-xl font-bold text-white mb-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-400 transition-all">
              {SUBJECT_LABELS[subj.id]}
            </h3>
            <p className="text-sm text-gray-500">點擊進入 {SUBJECT_LABELS[subj.id]} 任務中心</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TaskSelect({ user }: { user: UserProfile }) {
  const { subjectId } = useParams<{ subjectId: Subject }>();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subjectId) return;
    const fetchTasks = async () => {
      try {
        const q = query(
          collection(db, 'tasks'),
          where('subject', '==', subjectId),
          where('isActive', '==', true)
        );
        // order by createdAt desc (client side sort if index missing)
        const snap = await getDocs(q);
        const tasksData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
        tasksData.sort((a, b) => b.createdAt - a.createdAt);
        setTasks(tasksData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [subjectId]);

  if (!subjectId || !SUBJECT_LABELS[subjectId]) return <div>無效的科目</div>;

  return (
    <div className="max-w-3xl w-full mx-auto py-10">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-white mb-2">{SUBJECT_LABELS[subjectId]} 任務列表</h2>
        <p className="text-gray-400">指揮官已為您指派以下任務，請選擇並開始挑戰</p>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-10">讀取中...</div>
      ) : tasks.length === 0 ? (
        <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-10 text-center">
          <p className="text-gray-400">目前沒有可用的任務。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map(task => (
            <div key={task.id} className="bg-gray-900/80 border border-gray-800 hover:border-purple-500/50 rounded-2xl p-6 transition-all flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">{task.title}</h3>
                <div className="flex space-x-4 mt-2 text-sm text-gray-400">
                  <span>難度: {task.difficulty === 'easy' ? '簡單' : task.difficulty === 'medium' ? '中等' : task.difficulty === 'hard' ? '困難' : '混合'}</span>
                  <span>範圍: {task.targetUnits.length > 0 ? `第 ${task.targetUnits.join(', ')} 單元` : '全部'}</span>
                  <span>題數: {task.questionCount} 題</span>
                </div>
              </div>
              <button 
                onClick={() => navigate(`/play/${task.id}`)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-xl flex items-center shadow-lg transition-transform hover:scale-105"
              >
                開始挑戰 <Play size={16} className="ml-2" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

class ParticleEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  particles: any[] = [];
  animationId: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', this.resize);
    this.animate();
  }

  resize = () => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  createExplosion(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 3 + 1,
        color,
        alpha: 1,
        life: Math.random() * 30 + 20
      });
    }
  }

  animate = () => {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // gravity
      p.alpha -= 1 / p.life;
      
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
    this.animationId = requestAnimationFrame(this.animate);
  }

  destroy() {
    window.removeEventListener('resize', this.resize);
    cancelAnimationFrame(this.animationId);
  }
}

export function Gameplay({ user }: { user: UserProfile }) {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  
  // Game state
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [wrongQuestionIds, setWrongQuestionIds] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(Date.now());
  const [combo, setCombo] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [lastEffect, setLastEffect] = useState<'correct'|'wrong'|null>(null);
  
  const [inputVal, setInputVal] = useState('');
  
  useEffect(() => {
    if (canvasRef.current) {
      engineRef.current = new ParticleEngine(canvasRef.current);
    }
    return () => {
      engineRef.current?.destroy();
    };
  }, [canvasRef.current]);

  useEffect(() => {
    const initGame = async () => {
      if (!taskId) return;
      try {
        const taskSnap = await getDoc(doc(db, 'tasks', taskId));
        if (!taskSnap.exists()) {
          alert('找不到任務');
          navigate('/');
          return;
        }
        const taskData = { id: taskSnap.id, ...taskSnap.data() } as Task;
        setTask(taskData);
        
        // Fetch questions for this subject
        let qQuery = query(collection(db, 'questions'), where('subject', '==', taskData.subject));
        const qSnap = await getDocs(qQuery);
        let allQs = qSnap.docs.map(d => ({ id: d.id, ...d.data() } as Question));
        
        // Filter by target units
        if (taskData.targetUnits && taskData.targetUnits.length > 0) {
          allQs = allQs.filter(q => taskData.targetUnits.includes(q.unit));
        }
        // Filter by difficulty if not mixed
        if (taskData.difficulty !== 'mixed') {
          allQs = allQs.filter(q => q.difficulty === taskData.difficulty);
        }
        
        // Shuffle and slice
        allQs.sort(() => Math.random() - 0.5);
        if (allQs.length > taskData.questionCount) {
          allQs = allQs.slice(0, taskData.questionCount);
        }
        
        if (allQs.length === 0) {
          alert('找不到符合條件的題目');
          navigate(-1);
          return;
        }
        
        setQuestions(allQs);
        setStartTime(Date.now());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    initGame();
  }, [taskId, navigate]);

  const handleAnswer = async (answer: string) => {
    const currentQ = questions[currentIndex];
    
    // Check if the correct answer is Chinese
    const isChinese = /[\u4E00-\u9FFF]/.test(currentQ.correctAnswer);
    let isCorrect = false;

    if (isChinese && currentQ.type === 'fill_in_the_blank') {
        const ansPinyin = pinyin(answer.trim(), { toneType: 'none', v: true }).replace(/\s+/g, '').toLowerCase();
        const correctPinyin = pinyin(currentQ.correctAnswer.trim(), { toneType: 'none', v: true }).replace(/\s+/g, '').toLowerCase();
        isCorrect = (ansPinyin === correctPinyin) && answer.trim().length > 0;
    } else {
        isCorrect = answer.toLowerCase().trim() === currentQ.correctAnswer.toLowerCase().trim();
    }
    
    let currentScore = score;
    let currentCombo = combo;
    let currentEnergy = energy;

    if (isCorrect) {
      setLastEffect('correct');
      if (engineRef.current) {
        engineRef.current.createExplosion(window.innerWidth / 2, window.innerHeight / 2, '#4ade80', 50); // green
      }
      currentCombo += 1;
      currentEnergy = Math.min(currentEnergy + 10, 100);
      const multiplier = 1 + Math.floor(currentEnergy / 20) * 0.5;
      currentScore += Math.round(100 * multiplier);
      
      setCombo(currentCombo);
      setEnergy(currentEnergy);
      setScore(currentScore);
    } else {
      setLastEffect('wrong');
      if (engineRef.current) {
        engineRef.current.createExplosion(window.innerWidth / 2, window.innerHeight / 2, '#ef4444', 30); // red
      }
      currentCombo = 0;
      currentEnergy = 0;
      
      setCombo(currentCombo);
      setEnergy(currentEnergy);
      setLives(l => l - 1);
      setWrongQuestionIds(prev => [...prev, currentQ.id]);
    }
    
    setTimeout(() => setLastEffect(null), 600);
    setInputVal('');
    
    if (lives - (isCorrect ? 0 : 1) <= 0 || currentIndex + 1 >= questions.length) {
      // Game over
      const timeTaken = Date.now() - startTime;
      const totalQuestions = currentIndex + 1;
      const correctAnswers = totalQuestions - wrongQuestionIds.length - (isCorrect ? 0 : 1);
      const accuracy = Math.round((correctAnswers / totalQuestions) * 100);
      
      try {
        const attemptRef = await addDoc(collection(db, 'attempts'), {
          taskId: task!.id,
          userId: user.uid,
          userDisplayName: user.displayName,
          subject: task!.subject,
          score: currentScore,
          accuracy,
          timeTaken,
          wrongQuestionIds: [...wrongQuestionIds, ...(isCorrect ? [] : [currentQ.id])],
          timestamp: Date.now()
        } as Omit<Attempt, 'id'>);
        
        navigate(`/gameover/${attemptRef.id}`);
      } catch(e) {
        console.error(e);
        alert('儲存成績失敗');
      }
    } else {
      setCurrentIndex(i => i + 1);
    }
  };

  if (loading || !task) return <div className="text-center text-gray-500 py-10">載入任務中...</div>;

  const currentQ = questions[currentIndex];
  if (!currentQ) return <div className="text-center text-gray-500 py-10">結束中...</div>;

  return (
    <>
      <canvas 
        ref={canvasRef} 
        className="fixed inset-0 pointer-events-none z-50"
      />
      <div className={`max-w-2xl w-full mx-auto flex flex-col space-y-6 transition-all duration-300 relative z-10 ${lastEffect === 'correct' ? 'border-green-500/40' : lastEffect === 'wrong' ? 'border-red-500/40 animate-shake' : ''}`}>
        <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="text-xs text-gray-400 font-mono tracking-wider mr-1">LIVES:</div>
          <div className="flex space-x-1.5 text-red-500">
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className={i < lives ? 'opacity-100' : 'opacity-20'}>❤️</span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 font-mono tracking-wider uppercase">Score</p>
          <p className="text-2xl font-black text-yellow-400 font-mono">{String(score).padStart(5, '0')}</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-purple-500/20 rounded-2xl px-4 py-3 flex items-center space-x-2 relative overflow-hidden flex-1 select-none">
          <span className="text-2xl">🔥</span>
          <div>
            <p className="text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 font-mono">COMBO X{combo}</p>
            <p className="text-[10px] text-purple-300 uppercase tracking-widest font-mono">Combo Power-up</p>
          </div>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl px-5 py-3 text-center min-w-[80px] transition-all">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Multiplier</p>
          <p className="text-xl font-black text-purple-400 font-mono">{(1 + Math.floor(energy / 20) * 0.5).toFixed(1)}X</p>
        </div>
      </div>

      <div className="bg-gray-900/40 rounded-full p-1 border border-gray-800/60 relative overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${energy}%` }}></div>
        {energy >= 100 && <div className="absolute inset-0 bg-blue-500/20 mix-blend-screen opacity-0 animate-pulse rounded-full"></div>}
      </div>

      <div className={`bg-gray-900/80 border ${lastEffect === 'wrong' ? 'border-red-500' : lastEffect === 'correct' ? 'border-green-500' : 'border-gray-800'} rounded-3xl p-8 text-center shadow-xl relative neon-border transition-colors duration-300`}>
        {energy >= 100 && (
          <div className="absolute inset-x-0 top-0 bg-gradient-to-r from-blue-600/90 to-purple-600/90 py-1.5 px-4 text-center text-xs font-black tracking-widest uppercase text-white animate-pulse">
            ⚡ EXTREME ENERGY MODE! SCORE MULTIPLIED! ⚡
          </div>
        )}
        <div className={`flex items-center justify-between border-b border-gray-800 pb-4 mb-8 ${energy >= 100 ? 'pt-6' : ''}`}>
          <span className="text-xs bg-purple-500/20 text-purple-300 font-bold px-3 py-1 rounded-full uppercase tracking-widest font-mono">
            {currentQ.type === 'multiple_choice' ? '選擇題' : '填空/問答'}
          </span>
          <span className="text-xs text-gray-400 font-mono">
            QUEST <span className="text-purple-400 font-bold">{currentIndex + 1}</span> / {questions.length}
          </span>
        </div>
        
        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-8 leading-relaxed">
          {currentQ.prompt}
        </h3>
        
        {currentQ.clue && (
          <p className="text-sm text-gray-400 bg-gray-950/40 py-2 px-4 rounded-xl border border-gray-800/40 inline-block mb-6">
            提示: {currentQ.clue}
          </p>
        )}
        
        {currentQ.type === 'multiple_choice' && currentQ.options ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {currentQ.options.map((opt, idx) => (
              <button 
                key={idx}
                onClick={() => handleAnswer(opt)}
                className="bg-gray-800 hover:bg-purple-600 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-md"
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 max-w-md mx-auto">
            <input 
              type="text" 
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && inputVal && handleAnswer(inputVal)}
              placeholder="輸入你的答案"
              className="w-full bg-gray-950 border-2 border-gray-700 rounded-2xl px-5 py-4 text-center text-lg font-bold tracking-widest text-purple-300 focus:outline-none focus:border-purple-500"
            />
            <button 
              onClick={() => inputVal && handleAnswer(inputVal)}
              className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white font-extrabold rounded-2xl shadow-xl transition-all"
            >
              送出答案
            </button>
          </div>
        )}
      </div>
      </div>
    </>
  );
}

export function GameOver() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    const fetchAttempt = async () => {
      try {
        const snap = await getDoc(doc(db, 'attempts', attemptId));
        if (snap.exists()) {
          setAttempt({ id: snap.id, ...snap.data() } as Attempt);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchAttempt();
  }, [attemptId]);

  if (!attempt) return <div className="text-center py-10 text-gray-500">讀取成績中...</div>;

  return (
    <div className="max-w-xl w-full mx-auto flex flex-col space-y-6 animate-bounce-in py-10">
      <div className="bg-gray-900/60 backdrop-blur-md border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
        <h2 className="text-3xl font-black tracking-wider text-white">任務完成！</h2>
        <p className="text-gray-400 mt-2 text-sm">成績已紀錄至指揮中心。</p>
        
        <div className="grid grid-cols-2 gap-4 my-8">
          <div className="bg-gray-950/60 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-400 font-mono">最終分數</p>
            <p className="text-3xl font-black text-yellow-400 mt-1">{attempt.score}</p>
          </div>
          <div className="bg-gray-950/60 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-400 font-mono">答對率</p>
            <p className="text-3xl font-black text-green-400 mt-1">{attempt.accuracy}%</p>
          </div>
        </div>
        
        <div className="flex space-x-4">
          <button 
            onClick={() => navigate(`/play/${attempt.taskId}`)}
            className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-2xl shadow-lg transition-transform hover:scale-[1.02] flex justify-center items-center"
          >
            再戰一次 <RotateCcw size={18} className="ml-2" />
          </button>
          <button 
            onClick={() => navigate('/select-subject')}
            className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-2xl transition-transform hover:scale-[1.02] flex justify-center items-center"
          >
            回首頁 <Home size={18} className="ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}



// Pages

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Check if user exists in db
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        let profile: UserProfile;
        if (userSnap.exists()) {
          profile = userSnap.data() as UserProfile;
        } else {
          // New user, default to player
          profile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.isAnonymous ? '測試管理員' : (firebaseUser.displayName || 'Unknown Player'),
            photoURL: firebaseUser.photoURL || '',
            role: (firebaseUser.email === 'ianw.solar@gmail.com' || firebaseUser.isAnonymous) ? 'admin' : 'player'
          };
          await setDoc(userRef, profile);
        }
        setUser(profile);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-purple-300">Loading Quest System...</p>
      </div>
    );
  }

  return (
    <Router>
      <Layout user={user}>
        <Routes>
          <Route path="/" element={!user ? <SignIn /> : <Navigate to={user.role === 'admin' ? "/admin" : "/select-subject"} />} />
          
          {/* Player Routes */}
          <Route path="/select-subject" element={user ? <SubjectSelect /> : <Navigate to="/" />} />
          <Route path="/subject/:subjectId/tasks" element={user ? <TaskSelect user={user} /> : <Navigate to="/" />} />
          <Route path="/play/:taskId" element={user ? <Gameplay user={user} /> : <Navigate to="/" />} />
          <Route path="/gameover/:attemptId" element={user ? <GameOver /> : <Navigate to="/" />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={user && user.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
          <Route path="/admin/:subjectId" element={user && user.role === 'admin' ? <AdminSubjectView /> : <Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
}
