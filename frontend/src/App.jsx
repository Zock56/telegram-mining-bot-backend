import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Home, ShoppingCart, Trophy, Wallet } from 'lucide-react'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import './App.css'

// Componentes para cada vista
import HomeView from './components/HomeView.jsx'
import ShopView from './components/ShopView.jsx'
import QuestView from './components/QuestView.jsx'
import WalletView from './components/WalletView.jsx'

const manifestUrl = 'https://raw.githubusercontent.com/ton-community/tutorials/main/03-client/test/public/tonconnect-manifest.json';

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [userData, setUserData] = useState({
    telegramId: null,
    balance: 0,
    miningSpeed: 0,
    miner: null,
    isMining: false,
    lastMineTime: null,
    referralLink: '',
    walletAddress: '',
    quests: [],
    referralCount: 0
  })

  const fetchUserData = useCallback(async (id) => {
    try {
      const response = await fetch(`/api/user/${id}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setUserData(prev => ({
        ...prev,
        balance: data.balance,
        miningSpeed: data.miningSpeed,
        miner: data.miner,
        isMining: data.isMining,
        lastMineTime: data.lastMineTime,
        referralLink: data.referralLink,
        walletAddress: data.walletAddress,
        quests: data.quests,
        referralCount: data.referralCount
      }))
    } catch (error) {
      console.error("Error fetching user data:", error)
    }
  }, [])

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready()
      
      const user = tg.initDataUnsafe?.user
      if (user) {
        setUserData(prev => ({
          ...prev,
          telegramId: user.id,
          referralLink: `https://t.me/your_bot?start=${user.id}` // Placeholder, se actualizará desde el backend
        }))
        fetchUserData(user.id)
      }
    }
  }, [fetchUserData])

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
        <div className="container mx-auto px-4 py-6 max-w-md">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
              TON Mining dApp
            </h1>
            <p className="text-sm text-gray-400 mt-2">Balance: {userData.balance.toFixed(4)} TON</p>
          </div>

          {/* Navegación con Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6 bg-slate-800/50">
              <TabsTrigger value="home" className="data-[state=active]:bg-purple-600">
                <Home className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="shop" className="data-[state=active]:bg-purple-600">
                <ShoppingCart className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="quest" className="data-[state=active]:bg-purple-600">
                <Trophy className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="wallet" className="data-[state=active]:bg-purple-600">
                <Wallet className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="home" className="mt-0">
              <HomeView userData={userData} setUserData={setUserData} />
            </TabsContent>

            <TabsContent value="shop" className="mt-0">
              <ShopView userData={userData} setUserData={setUserData} />
            </TabsContent>

            <TabsContent value="quest" className="mt-0">
              <QuestView userData={userData} setUserData={setUserData} />
            </TabsContent>

            <TabsContent value="wallet" className="mt-0">
              <WalletView userData={userData} setUserData={setUserData} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TonConnectUIProvider>
  )
}

export default App
