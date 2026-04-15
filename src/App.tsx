import React, { useState, useEffect, Component, ReactNode, ErrorInfo } from 'react';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  PieChart, 
  User as UserIcon, 
  LogOut, 
  Mic, 
  Send, 
  X, 
  Check,
  TrendingUp,
  TrendingDown,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip,
  Legend
} from 'recharts';
import { 
  addTransaction, 
  subscribeTransactions, 
  subscribeCategories, 
  addCategory,
  deleteCategory,
  testConnection 
} from './services/firebaseService';
import { parseTransactionText } from './services/geminiService';
import { Transaction, Category, TransactionType, AIParseResult } from './types';

// --- Components ---

const Navbar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) => (
  <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex justify-around items-center z-50">
    <button 
      onClick={() => setActiveTab('home')}
      className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-black' : 'text-gray-400'}`}
    >
      <Plus size={24} />
      <span className="text-[10px] font-medium uppercase tracking-wider">记账</span>
    </button>
    <button 
      onClick={() => setActiveTab('stats')}
      className={`flex flex-col items-center gap-1 ${activeTab === 'stats' ? 'text-black' : 'text-gray-400'}`}
    >
      <PieChart size={24} />
      <span className="text-[10px] font-medium uppercase tracking-wider">统计</span>
    </button>
    <button 
      onClick={() => setActiveTab('profile')}
      className={`flex flex-col items-center gap-1 ${activeTab === 'profile' ? 'text-black' : 'text-gray-400'}`}
    >
      <UserIcon size={24} />
      <span className="text-[10px] font-medium uppercase tracking-wider">我的</span>
    </button>
  </div>
);

const TransactionItem = ({ transaction }: { transaction: Transaction }) => {
  const date = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-gray-900">{transaction.categoryName}</span>
        <span className="text-xs text-gray-400">{transaction.note || '无备注'}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className={`text-sm font-mono font-bold ${transaction.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
          {transaction.type === 'expense' ? '-' : '+'}{transaction.amount.toFixed(2)}
        </span>
        <span className="text-[10px] text-gray-400 uppercase tracking-tighter">
          {date.toLocaleDateString()}
        </span>
      </div>
    </div>
  );
};

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-white px-8 text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl mb-6 flex items-center justify-center">
            <X size={32} />
          </div>
          <h1 className="text-xl font-bold mb-2">出错了</h1>
          <p className="text-gray-500 text-sm mb-8 max-w-xs">
            {this.state.error?.message || "应用程序发生意外错误"}
          </p>
          <Button onClick={() => window.location.reload()} className="bg-black text-white rounded-xl px-8">
            重试
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [preview, setPreview] = useState<AIParseResult | null>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const unsubTransactions = subscribeTransactions(user.uid, setTransactions);
      const unsubCategories = subscribeCategories(user.uid, setCategories);
      return () => {
        unsubTransactions();
        unsubCategories();
      };
    }
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Set custom parameters if needed
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider);
      console.log("Login success:", result.user.email);
      toast.success('登录成功');
    } catch (error: any) {
      console.error("Login Error:", error);
      
      let message = '登录失败';
      if (error.code === 'auth/popup-blocked') {
        message = '登录窗口被浏览器拦截，请允许弹出窗口';
      } else if (error.code === 'auth/unauthorized-domain') {
        message = '当前域名未在 Firebase 控制台授权，请检查 OAuth 授权域名设置';
      } else if (error.code === 'auth/popup-closed-by-user') {
        message = '登录窗口已关闭';
      } else if (error.message) {
        message = `登录失败: ${error.message}`;
      }
      
      toast.error(message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('已退出登录');
    } catch (error) {
      toast.error('退出失败');
    }
  };

  const handleParse = async () => {
    if (!inputText.trim()) return;
    setIsParsing(true);
    const result = await parseTransactionText(inputText);
    setIsParsing(false);
    if (result) {
      setPreview(result);
    } else {
      toast.error('无法解析，请尝试更清晰的描述');
    }
  };

  const handleConfirm = async () => {
    if (!user || !preview) return;
    try {
      await addTransaction({
        userId: user.uid,
        amount: preview.amount,
        type: preview.type,
        categoryName: preview.categoryName,
        note: preview.note,
        date: new Date(),
      });
      
      // Check if category exists, if not add it (simplified logic)
      const exists = categories.find(c => c.name === preview.categoryName && c.type === preview.type);
      if (!exists) {
        await addCategory({
          userId: user.uid,
          name: preview.categoryName,
          type: preview.type,
          isDefault: false
        });
      }

      toast.success('记账成功');
      setPreview(null);
      setInputText('');
    } catch (error) {
      toast.error('保存失败');
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      toast.error('您的浏览器不支持语音识别');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      toast.info(`识别到: ${transcript}`);
    };
    recognition.start();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <motion.div 
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-12 h-12 bg-black rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white px-8">
        <div className="w-20 h-20 bg-black rounded-3xl mb-8 flex items-center justify-center">
          <TrendingUp className="text-white" size={40} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Smart Ledger</h1>
        <p className="text-gray-400 text-center mb-12">极简 AI 记账，一句话掌控收支</p>
        <Button onClick={handleLogin} className="w-full bg-black text-white hover:bg-gray-800 h-14 rounded-2xl text-lg font-semibold">
          Google 账号登录
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24 font-sans text-gray-900">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="px-6 pt-12 pb-6 flex justify-between items-center bg-white sticky top-0 z-40">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </h2>
          <h1 className="text-2xl font-black">
            {activeTab === 'home' ? '智能记账' : activeTab === 'stats' ? '收支统计' : '个人中心'}
          </h1>
        </div>
        {activeTab === 'home' && (
          <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center">
            <TrendingUp size={20} className="text-black" />
          </div>
        )}
      </header>

      <main className="px-6">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Input Area */}
              <div className="relative">
                {!preview ? (
                  <div className="relative group">
                    <Input
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="例如：中午吃面15元"
                      className="h-16 pl-6 pr-24 bg-gray-50 border-none rounded-2xl text-lg focus-visible:ring-1 focus-visible:ring-black transition-all"
                      onKeyDown={(e) => e.key === 'Enter' && handleParse()}
                    />
                    <div className="absolute right-2 top-2 flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={startListening}
                        className={`h-12 w-12 rounded-xl transition-colors ${isListening ? 'bg-red-50 text-red-500' : 'hover:bg-gray-100'}`}
                      >
                        <Mic size={20} />
                      </Button>
                      <Button 
                        size="icon" 
                        onClick={handleParse}
                        disabled={isParsing || !inputText}
                        className="h-12 w-12 bg-black text-white rounded-xl hover:bg-gray-800 disabled:bg-gray-200"
                      >
                        {isParsing ? (
                          <motion.div 
                            animate={{ rotate: 360 }} 
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          >
                            <History size={20} />
                          </motion.div>
                        ) : (
                          <Send size={20} />
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-black text-white p-6 rounded-3xl space-y-6 shadow-2xl shadow-black/10"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <Badge variant="outline" className="text-white border-white/20 mb-2 uppercase tracking-widest text-[10px]">
                          AI 识别结果
                        </Badge>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-black">¥{preview.amount.toFixed(2)}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${preview.type === 'expense' ? 'bg-red-500' : 'bg-green-500'}`}>
                            {preview.type === 'expense' ? '支出' : '收入'}
                          </span>
                        </div>
                      </div>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => setPreview(null)}
                        className="text-white/50 hover:text-white hover:bg-white/10"
                      >
                        <X size={24} />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">分类</span>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="bg-white/10 text-white hover:bg-white/20 border-none px-3 py-1">
                            {preview.categoryName}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">备注</span>
                        <p className="text-sm font-medium">{preview.note || '无'}</p>
                      </div>
                    </div>

                    <Button 
                      onClick={handleConfirm}
                      className="w-full bg-white text-black hover:bg-gray-100 h-14 rounded-2xl text-lg font-black flex gap-2"
                    >
                      <Check size={24} /> 确认记账
                    </Button>
                  </motion.div>
                )}
              </div>

              {/* Recent Transactions */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">最近记录</h3>
                  <History size={16} className="text-gray-300" />
                </div>
                <Card className="border-none shadow-none bg-transparent">
                  <CardContent className="p-0">
                    {transactions.length > 0 ? (
                      transactions.slice(0, 10).map(t => (
                        <div key={t.id}>
                          <TransactionItem transaction={t} />
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center">
                        <p className="text-gray-300 text-sm italic">还没有记录，开始记一笔吧</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <Tabs defaultValue="expense" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-gray-50 p-1 rounded-2xl h-12">
                  <TabsTrigger value="expense" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold">支出分析</TabsTrigger>
                  <TabsTrigger value="income" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold">收入分析</TabsTrigger>
                </TabsList>
                
                {['expense', 'income'].map((type) => (
                  <TabsContent key={type} value={type} className="space-y-8 mt-6">
                    {/* Pie Chart */}
                    <Card className="border-none bg-gray-50 rounded-3xl overflow-hidden shadow-none">
                      <CardHeader className="pb-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-gray-400">分类占比</CardTitle>
                      </CardHeader>
                      <CardContent className="h-64 pt-0">
                        {transactions.filter(t => t.type === type).length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                              <Pie
                                data={Object.entries(
                                  transactions
                                    .filter(t => t.type === type)
                                    .reduce((acc, t) => {
                                      acc[t.categoryName] = (acc[t.categoryName] || 0) + t.amount;
                                      return acc;
                                    }, {} as Record<string, number>)
                                ).map(([name, value]) => ({ name, value }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {[0, 1, 2, 3, 4, 5].map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={['#000000', '#404040', '#737373', '#A3A3A3', '#D4D4D4', '#E5E5E5'][index % 6]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </RePieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-300 text-sm">暂无数据</div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Bar Chart - Daily Trend */}
                    <Card className="border-none bg-gray-50 rounded-3xl overflow-hidden shadow-none">
                      <CardHeader className="pb-0">
                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-gray-400">每日趋势</CardTitle>
                      </CardHeader>
                      <CardContent className="h-64 pt-4">
                        {transactions.filter(t => t.type === type).length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={
                              Object.entries(
                                transactions
                                  .filter(t => t.type === type)
                                  .reduce((acc, t) => {
                                    const date = t.date?.toDate ? t.date.toDate().toLocaleDateString() : new Date(t.date).toLocaleDateString();
                                    acc[date] = (acc[date] || 0) + t.amount;
                                    return acc;
                                  }, {} as Record<string, number>)
                              )
                              .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
                              .slice(-7)
                              .map(([date, amount]) => ({ date: date.split('/')[1] + '/' + date.split('/')[2], amount }))
                            }>
                              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                              <YAxis hide />
                              <Tooltip cursor={{ fill: 'transparent' }} />
                              <Bar dataKey="amount" fill="#000000" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-gray-300 text-sm">暂无数据</div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex flex-col items-center py-8 space-y-4">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-50 shadow-xl">
                  <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} alt="avatar" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-black">{user.displayName || '用户'}</h3>
                  <p className="text-sm text-gray-400 font-medium">{user.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card className="border-none bg-gray-50 rounded-3xl p-6 text-center shadow-none">
                  <TrendingDown size={24} className="mx-auto mb-2 text-red-500" />
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest block">本月支出</span>
                  <span className="text-xl font-black">¥{transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0).toFixed(2)}</span>
                </Card>
                <Card className="border-none bg-gray-50 rounded-3xl p-6 text-center shadow-none">
                  <TrendingUp size={24} className="mx-auto mb-2 text-green-500" />
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest block">本月收入</span>
                  <span className="text-xl font-black">¥{transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0).toFixed(2)}</span>
                </Card>
              </div>

              <div className="space-y-3">
                <Button 
                  variant="outline" 
                  onClick={handleLogout}
                  className="w-full h-16 rounded-2xl border-gray-100 hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all flex justify-between px-6 group"
                >
                  <div className="flex items-center gap-3">
                    <LogOut size={20} />
                    <span className="font-bold">退出登录</span>
                  </div>
                  <X size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
