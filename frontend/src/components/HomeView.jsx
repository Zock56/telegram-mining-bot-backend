import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { Pickaxe, Hourglass, Gem } from 'lucide-react'

function HomeView({ userData, setUserData }) {
  const [miningProgress, setMiningProgress] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0) // Tiempo restante en segundos
  const [isMiningActive, setIsMiningActive] = useState(false)

  const fetchUserData = useCallback(async () => {
    if (!userData.telegramId) return

    try {
      const response = await fetch(`/api/user/${userData.telegramId}`)
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
        walletAddress: data.walletAddress
      }))

      if (data.isMining && data.lastMineTime) {
        const lastMineDate = new Date(data.lastMineTime)
        const fourHoursInMs = 4 * 3600 * 1000
        const endTime = lastMineDate.getTime() + fourHoursInMs
        const now = Date.now()
        const remainingTime = Math.max(0, endTime - now)
        setTimeLeft(Math.ceil(remainingTime / 1000))
        setIsMiningActive(true)
      } else {
        setIsMiningActive(false)
        setTimeLeft(0)
      }

    } catch (error) {
      console.error("Error fetching user data:", error)
    }
  }, [userData.telegramId, setUserData])

  useEffect(() => {
    fetchUserData()

    const interval = setInterval(() => {
      if (isMiningActive && timeLeft > 0) {
        setTimeLeft(prev => prev - 1)
        const fourHoursInSeconds = 4 * 3600
        setMiningProgress(100 - (timeLeft / fourHoursInSeconds) * 100)
      } else if (timeLeft === 0 && isMiningActive) {
        setIsMiningActive(false)
        setMiningProgress(100)
        // Opcional: Notificar al usuario que la minería ha terminado y puede reclamar
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [fetchUserData, isMiningActive, timeLeft])

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleStartMining = async () => {
    if (!userData.telegramId) {
      alert("No se pudo obtener el ID de Telegram del usuario.")
      return
    }
    if (!userData.miner) {
      alert("Necesitas comprar un minero para empezar a minar.")
      return
    }
    if (isMiningActive) {
      alert("Ya estás minando o en tiempo de espera.")
      return
    }

    try {
      const response = await fetch('/api/mine/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: userData.telegramId })
      })
      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Error al iniciar la minería.')
        return
      }

      alert(data.message)
      setUserData(prev => ({ ...prev, lastMineTime: data.lastMineTime, isMining: true }))
      setIsMiningActive(true)
      setTimeLeft(4 * 3600) // 4 horas en segundos
      setMiningProgress(0)

    } catch (error) {
      console.error("Error starting mining:", error)
      alert("Error de conexión al iniciar la minería.")
    }
  }

  const handleClaimRewards = async () => {
    if (!userData.telegramId) {
      alert("No se pudo obtener el ID de Telegram del usuario.")
      return
    }
    if (!userData.miner) {
      alert("No tienes un minero activo para reclamar recompensas.")
      return
    }
    if (timeLeft > 0) {
      alert("La minería aún no ha terminado.")
      return
    }

    try {
      const response = await fetch('/api/mine/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: userData.telegramId })
      })
      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Error al reclamar recompensas.')
        return
      }

      alert(`¡Has reclamado ${data.earnings.toFixed(4)} TON!`) // Mostrar ganancias
      setUserData(prev => ({ ...prev, balance: data.newBalance, isMining: false, lastMineTime: null }))
      setIsMiningActive(false)
      setTimeLeft(0)
      setMiningProgress(0)

    } catch (error) {
      console.error("Error claiming rewards:", error)
      alert("Error de conexión al reclamar recompensas.")
    }
  }

  return (
    <div className="space-y-6">
      {/* Minero Actual */}
      <Card className="bg-slate-800/50 border-purple-500/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Pickaxe className="w-5 h-5 text-purple-400" />
            Tu Minero
          </CardTitle>
          <CardDescription className="text-gray-400">
            {userData.miner ? `Minero activo: ${userData.miner.name}` : 'No tienes ningún minero activo'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userData.miner ? (
            <div className="text-center">
              <p className="text-5xl font-bold text-purple-400">{userData.miner.name}</p>
              <p className="text-gray-400 mt-2">Velocidad de minado: {userData.miner.miningSpeed} TON/hr</p>
              <p className="text-gray-400">ROI: {userData.miner.roi}% en {userData.miner.profitDays} días</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">Visita la tienda para adquirir tu primer minero.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel de Minería */}
      <Card className="bg-slate-800/50 border-purple-500/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gem className="w-5 h-5 text-green-400" />
            Estado de Minería
          </CardTitle>
          <CardDescription className="text-gray-400">
            {isMiningActive && timeLeft > 0
              ? `Minando... ${formatTime(timeLeft)} restante`
              : userData.miner && !isMiningActive && timeLeft === 0
              ? 'Minería lista para reclamar o iniciar'
              : 'Inicia la minería para ganar TON'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-4xl font-bold text-green-400">{userData.miningSpeed.toFixed(4)} TON/hr</p>
            <p className="text-gray-400 mt-2">Velocidad actual</p>
          </div>
          <Progress value={miningProgress} className="w-full" />
          <div className="flex justify-between text-sm text-gray-400">
            <span>Progreso</span>
            <span>{miningProgress.toFixed(0)}%</span>
          </div>
        </CardContent>
        <CardFooter>
          {userData.miner ? (
            isMiningActive ? (
              <Button
                onClick={handleClaimRewards}
                disabled={timeLeft > 0}
                className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {timeLeft > 0 ? `Minando (${formatTime(timeLeft)})` : 'Reclamar Recompensas'}
              </Button>
            ) : (
              <Button
                onClick={handleStartMining}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold"
              >
                Start Mining
              </Button>
            )
          ) : (
            <Button disabled className="w-full bg-gray-600/50 cursor-not-allowed text-white font-bold">
              Compra un minero para empezar
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

export default HomeView

