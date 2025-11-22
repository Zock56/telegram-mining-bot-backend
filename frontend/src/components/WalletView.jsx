import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Wallet, ArrowDownToLine, ArrowUpFromLine, History, AlertCircle } from 'lucide-react'
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react'
import { beginCell, toNano } from 'ton'

// Datos de ejemplo para el historial (esto debería venir del backend)
const mockTransactions = [
  { id: 1, type: 'deposit', amount: 10, date: '2025-10-01 14:30', status: 'completed' },
  { id: 2, type: 'purchase', amount: -5, date: '2025-10-02 09:15', status: 'completed' },
  { id: 3, type: 'withdrawal', amount: -3, date: '2025-10-03 18:45', status: 'completed' }
]

function WalletView({ userData, setUserData }) {
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [transactions, setTransactions] = useState(mockTransactions)

  const [tonConnectUI] = useTonConnectUI()
  const wallet = useTonWallet()

  useEffect(() => {
    if (wallet) {
      setUserData(prev => ({
        ...prev,
        walletAddress: wallet.account.address
      }))
    } else {
      setUserData(prev => ({
        ...prev,
        walletAddress: ''
      }))
    }
  }, [wallet, setUserData])

  const handleConnectWallet = async () => {
    if (!wallet) {
      await tonConnectUI.openModal()
    }
  }

  const handleDisconnectWallet = async () => {
    if (wallet) {
      await tonConnectUI.disconnect()
    }
  }

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount)
    const minWithdrawal = 3

    // Validaciones
    if (!withdrawAddress) {
      alert('Por favor, ingresa una dirección de wallet válida')
      return
    }

    if (!amount || amount <= 0) {
      alert('Por favor, ingresa una cantidad válida')
      return
    }

    if (amount < minWithdrawal) {
      alert(`El retiro mínimo es de ${minWithdrawal} TON`)
      return
    }

    if (amount > userData.balance) {
      alert('Fondos insuficientes')
      return
    }

    // Calcular fee (ejemplo: 0.5% o mínimo 0.01 TON)
    const fee = Math.max(amount * 0.005, 0.01)
    const totalAmount = amount + fee

    if (totalAmount > userData.balance) {
      alert(`Fondos insuficientes. Necesitas ${totalAmount.toFixed(4)} TON (incluyendo fee de ${fee.toFixed(4)} TON)`)
      return
    }

    if (!wallet) {
      alert('Por favor, conecta tu wallet de TON para realizar retiros.')
      return
    }

    // Confirmar retiro
    const confirmed = window.confirm(
      `¿Confirmar retiro de ${amount} TON a ${withdrawAddress}?\n\nFee de transacción: ${fee.toFixed(4)} TON\nTotal a descontar: ${totalAmount.toFixed(4)} TON`
    )

    if (confirmed) {
      try {
        // Crear mensaje de transacción para TON Connect
        const transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 360, // 6 minutos
          messages: [
            {
              address: withdrawAddress, // Dirección de destino
              amount: toNano(amount).toString(), // Cantidad en nanoTON
              payload: beginCell().storeUint(0, 32).storeStringTail('Withdrawal from TON Mining dApp').endCell().toBoc().toString('base64'),
            }
          ]
        }

        // Enviar transacción a través de TON Connect
        const result = await tonConnectUI.sendTransaction(transaction)
        console.log('TON Connect Transaction Result:', result)

        // Si la transacción es exitosa, actualizar el backend
        // Aquí se debería llamar a la API del backend para registrar el retiro
        // fetch('/api/wallet/withdraw', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({
        //     telegramId: userData.telegramId,
        //     amount: amount,
        //     address: withdrawAddress,
        //     transactionHash: result.boc // O el hash real de la transacción
        //   })
        // })
        // .then(res => res.json())
        // .then(data => {
        //   if (data.newBalance) {
        //     setUserData(prev => ({ ...prev, balance: data.newBalance }))
        //   }
        //   alert('Retiro procesado exitosamente. Recibirás tus fondos en unos minutos.')
        // })
        // .catch(error => {
        //   console.error('Error al registrar el retiro en el backend:', error)
        //   alert('Error al procesar el retiro. Por favor, inténtalo de nuevo.')
        // })

        // Simulación de procesamiento de retiro (eliminar cuando se integre el backend)
        setUserData(prev => ({
          ...prev,
          balance: prev.balance - totalAmount
        }))

        const newTransaction = {
          id: transactions.length + 1,
          type: 'withdrawal',
          amount: -amount,
          date: new Date().toLocaleString('es-ES'),
          status: 'pending' // El estado real se actualizaría desde el backend
        }
        setTransactions(prev => [newTransaction, ...prev])

        alert('Retiro procesado exitosamente. Recibirás tus fondos en unos minutos.')
        setWithdrawAmount('')
        setWithdrawAddress('')

      } catch (error) {
        console.error('Error al enviar la transacción TON Connect:', error)
        alert('Error al enviar la transacción. Por favor, asegúrate de que tu wallet esté conectada y tengas suficientes fondos.')
      }
    }
  }

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownToLine className="w-4 h-4 text-green-400" />
      case 'withdrawal':
        return <ArrowUpFromLine className="w-4 h-4 text-red-400" />
      case 'purchase':
        return <Wallet className="w-4 h-4 text-blue-400" />
      default:
        return null
    }
  }

  const getTransactionLabel = (type) => {
    switch (type) {
      case 'deposit':
        return 'Depósito'
      case 'withdrawal':
        return 'Retiro'
      case 'purchase':
        return 'Compra'
      default:
        return type
    }
  }

  return (
    <div className="space-y-6">
      {/* Conexión de Wallet */}
      <Card className="bg-slate-800/50 border-purple-500/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-400" />
            TON Wallet
          </CardTitle>
          <CardDescription className="text-gray-400">
            {userData.walletAddress ? 'Wallet conectada' : 'Conecta tu wallet de TON'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userData.walletAddress ? (
            <div className="space-y-3">
              <div className="bg-slate-900/50 p-4 rounded-lg">
                <p className="text-gray-400 text-xs mb-1">Dirección</p>
                <p className="text-white font-mono text-sm break-all">{userData.walletAddress}</p>
              </div>
              <Button
                onClick={handleDisconnectWallet}
                variant="outline"
                className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                Desconectar Wallet
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleConnectWallet}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold"
            >
              Conectar TON Wallet
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Balance */}
      <Card className="bg-slate-800/50 border-purple-500/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-white">Balance Disponible</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <p className="text-5xl font-bold text-purple-400">{userData.balance.toFixed(4)}</p>
            <p className="text-gray-400 mt-2">TON</p>
          </div>
        </CardContent>
      </Card>

      {/* Historial de transacciones */}
      <Card className="bg-slate-800/50 border-purple-500/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <History className="w-5 h-5 text-purple-400" />
            Historial de Transacciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-slate-900/50 p-3 rounded-lg flex justify-between items-center"
                >
                  <div className="flex items-center gap-3">
                    {getTransactionIcon(tx.type)}
                    <div>
                      <p className="text-white font-medium">{getTransactionLabel(tx.type)}</p>
                      <p className="text-gray-400 text-xs">{tx.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(4)} TON
                    </p>
                    <p className="text-gray-400 text-xs capitalize">{tx.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-4">No hay transacciones aún</p>
          )}
        </CardContent>
      </Card>

      {/* Retiro */}
      <Card className="bg-slate-800/50 border-purple-500/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ArrowUpFromLine className="w-5 h-5 text-red-400" />
            Retirar TON
          </CardTitle>
          <CardDescription className="text-gray-400">
            Retiro mínimo: 3 TON
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-yellow-200 text-sm">
              Se cobrará un fee de transacción del 0.5% (mínimo 0.01 TON) por cada retiro.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="withdraw-address" className="text-white">
              Dirección de Wallet
            </Label>
            <Input
              id="withdraw-address"
              placeholder="EQDtFpEwcFAEcRe5mLVh2N6C0x..."
              value={withdrawAddress}
              onChange={(e) => setWithdrawAddress(e.target.value)}
              className="bg-slate-900/50 border-purple-500/30 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="withdraw-amount" className="text-white">
              Cantidad (TON)
            </Label>
            <Input
              id="withdraw-amount"
              type="number"
              placeholder="3.0000"
              min="3"
              step="0.0001"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="bg-slate-900/50 border-purple-500/30 text-white"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleWithdraw}
            disabled={!userData.walletAddress}
            className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {userData.walletAddress ? 'Retirar' : 'Conecta tu wallet primero'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default WalletView
