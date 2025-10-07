import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Users, Gift, Copy, Share2, CheckCircle2 } from 'lucide-react'

function QuestView({ userData, setUserData }) {
  const [quests, setQuests] = useState([])
  const [referralCount, setReferralCount] = useState(0)
  const [copied, setCopied] = useState(false)

  const fetchQuestData = useCallback(async () => {
    if (!userData.telegramId) return

    try {
      const response = await fetch(`/api/user/${userData.telegramId}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setQuests(data.quests || [])
      setReferralCount(data.referralCount || 0)
      setUserData(prev => ({
        ...prev,
        referralLink: data.referralLink
      }))
    } catch (error) {
      console.error("Error fetching quest data:", error)
    }
  }, [userData.telegramId, setUserData])

  useEffect(() => {
    fetchQuestData()
  }, [fetchQuestData])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(userData.referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShareLink = () => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(userData.referralLink)}&text=${encodeURIComponent('¡Únete a TON Mining dApp y comienza a minar!')}`
      tg.openTelegramLink(shareUrl)
    } else {
      if (navigator.share) {
        navigator.share({
          title: 'TON Mining dApp',
          text: '¡Únete a TON Mining dApp y comienza a minar!',
          url: userData.referralLink
        })
      } else {
        handleCopyLink()
      }
    }
  }

  const handleClaimQuest = async (questId) => {
    try {
      const response = await fetch('/api/quests/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: userData.telegramId,
          questId: questId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Error al reclamar la recompensa de la misión.')
        return
      }

      alert(data.message)
      setUserData(prev => ({ ...prev, balance: data.newBalance }))
      fetchQuestData() // Volver a cargar los datos para actualizar el estado de las misiones

    } catch (error) {
      console.error("Error claiming quest reward:", error)
      alert('Error de conexión al reclamar la recompensa.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Link de referido */}
      <Card className="bg-slate-800/50 border-purple-500/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Tu Link de Referido
          </CardTitle>
          <CardDescription className="text-gray-400">
            Comparte tu link y gana recompensas por cada amigo que se una
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={userData.referralLink}
              readOnly
              className="bg-slate-900/50 border-purple-500/30 text-white"
            />
            <Button
              onClick={handleCopyLink}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <Button
            onClick={handleShareLink}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Compartir en Telegram
          </Button>
          <div className="bg-slate-900/50 p-4 rounded-lg text-center">
            <p className="text-gray-400 text-sm mb-1">Referidos totales</p>
            <p className="text-3xl font-bold text-purple-400">{referralCount}</p>
          </div>
        </CardContent>
      </Card>

      {/* Misiones */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Gift className="w-5 h-5 text-yellow-400" />
          Misiones de Referidos
        </h2>

        {quests.length > 0 ? (quests.map((quest) => (
          <Card
            key={quest.id}
            className={`bg-slate-800/50 border-purple-500/30 backdrop-blur transition-all ${
              quest.status === 'completed' && 'border-green-500/60 shadow-lg shadow-green-500/20'
            }`}
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-white text-lg">{quest.name}</CardTitle>
                  <CardDescription className="text-gray-400">
                    {quest.description}
                  </CardDescription>
                </div>
                {quest.status === 'claimed' && (
                  <Badge className="bg-gray-600">Reclamada</Badge>
                )}
                {quest.status === 'completed' && (
                  <Badge className="bg-green-600">Completada</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Progreso</span>
                <span className="text-white font-bold">
                  {Math.min(quest.progress, quest.requiredReferrals)} / {quest.requiredReferrals}
                </span>
              </div>
              <div className="w-full bg-slate-900/50 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min((quest.progress / quest.requiredReferrals) * 100, 100)}%`
                  }}
                />
              </div>
              <div className="bg-slate-900/50 p-3 rounded-lg flex justify-between items-center">
                <span className="text-gray-400 text-sm">Recompensa</span>
                <span className="text-yellow-400 font-bold text-lg">{quest.reward} TON</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => handleClaimQuest(quest.id)}
                disabled={quest.status !== 'completed'}
                className={`w-full ${
                  quest.status === 'claimed'
                    ? 'bg-gray-600 cursor-not-allowed'
                    : quest.status === 'completed'
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                    : 'bg-gray-600/50 cursor-not-allowed'
                } text-white font-bold`}
              >
                {quest.status === 'claimed'
                  ? 'Ya reclamada'
                  : quest.status === 'completed'
                  ? 'Reclamar Recompensa'
                  : 'No completada'}
              </Button>
            </CardFooter>
          </Card>
        ))) : (
          <p className="text-gray-400 text-center py-4">Cargando misiones...</p>
        )}
      </div>
    </div>
  )
}

export default QuestView
