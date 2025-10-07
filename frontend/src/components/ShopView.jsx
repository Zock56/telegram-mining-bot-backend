import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Pickaxe, TrendingUp, Calendar } from 'lucide-react'

function ShopView({ userData, setUserData }) {
  const [miners, setMiners] = useState([])

  const fetchMiners = useCallback(async () => {
    try {
      const response = await fetch('/api/miners')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setMiners(data)
    } catch (error) {
      console.error("Error fetching miners:", error)
    }
  }, [])

  useEffect(() => {
    fetchMiners()
  }, [fetchMiners])

  const handlePurchase = async (miner) => {
    if (!userData.telegramId) {
      alert("No se pudo obtener el ID de Telegram del usuario.")
      return
    }
    if (userData.balance < miner.price) {
      alert('Fondos insuficientes. Por favor, deposita más TON en tu wallet.')
      return
    }

    const confirmed = window.confirm(
      `¿Confirmar compra de ${miner.name} por ${miner.price} TON?`
    )

    if (confirmed) {
      try {
        const response = await fetch('/api/shop/buy_miner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegramId: userData.telegramId,
            minerId: miner.id
          })
        })
        const data = await response.json()

        if (!response.ok) {
          alert(data.error || 'Error al comprar el minero.')
          return
        }

        alert(data.message)
        setUserData(prev => ({
          ...prev,
          balance: data.newBalance,
          miner: miner, // Actualizar el minero activo en el frontend
          miningSpeed: data.newMiningSpeed
        }))

      } catch (error) {
        console.error("Error purchasing miner:", error)
        alert("Error de conexión al comprar el minero.")
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Tienda de Mineros</h2>
        <p className="text-gray-400">Todos los mineros tienen un ROI del 120% en 30 días</p>
      </div>

      <div className="grid gap-4">
        {miners.length > 0 ? (miners.map((miner) => (
          <Card 
            key={miner.id} 
            className={`bg-slate-800/50 border-purple-500/30 backdrop-blur transition-all hover:border-purple-500/60 hover:shadow-lg hover:shadow-purple-500/20 ${
              userData.miner?.id === miner.id ? 'border-green-500/60' : ''
            }`}
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg">
                    <Pickaxe className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-white">{miner.name}</CardTitle>
                    <CardDescription className="text-gray-400 text-sm">
                      {miner.description}
                    </CardDescription>
                  </div>
                </div>
                {userData.miner?.id === miner.id && (
                  <Badge className="bg-green-600">Activo</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-900/50 p-3 rounded-lg">
                  <p className="text-gray-400 text-xs mb-1">Precio</p>
                  <p className="text-white font-bold text-lg">{miner.price} TON</p>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-lg">
                  <p className="text-gray-400 text-xs mb-1">Velocidad</p>
                  <p className="text-white font-bold text-lg">{miner.miningSpeed.toFixed(5)} TON/h</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 bg-slate-900/50 p-3 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <div>
                    <p className="text-gray-400 text-xs">ROI</p>
                    <p className="text-green-400 font-bold">{miner.roi}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/50 p-3 rounded-lg">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="text-gray-400 text-xs">Período</p>
                    <p className="text-blue-400 font-bold">{miner.profitDays} días</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/50 p-3 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Ganancia total en 30 días</p>
                <p className="text-purple-400 font-bold text-lg">
                  {(miner.price * (miner.roi / 100)).toFixed(4)} TON
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => handlePurchase(miner)}
                disabled={userData.miner?.id === miner.id || userData.balance < miner.price}
                className={`w-full ${
                  userData.miner?.id === miner.id
                    ? 'bg-gray-600 cursor-not-allowed'
                    : userData.balance < miner.price
                    ? 'bg-red-600/50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                } text-white font-bold`}
              >
                {userData.miner?.id === miner.id
                  ? 'Ya tienes este minero'
                  : userData.balance < miner.price
                  ? 'Fondos insuficientes'
                  : `Comprar por ${miner.price} TON`}
              </Button>
            </CardFooter>
          </Card>
        ))) : (
          <p className="text-gray-400 text-center py-4">Cargando mineros...</p>
        )}
      </div>
    </div>
  )
}

export default ShopView
