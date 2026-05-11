'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { getAvailableWallets, connectWallet } from '@/utils/wallet'
import { useWalletContext } from '@/context/WalletContext'

const PREPROD_GENESIS = 1655683200

function slotToDate(slot: number): Date {
  return new Date((slot + PREPROD_GENESIS) * 1000)
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

function daysUntil(date: Date): number {
  const now = new Date()
  return Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [wallets, setWallets] = useState<any[]>([])
  const [connecting, setConnecting] = useState(false)
  const [contracts, setContracts] = useState<any[]>([])
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [pendingWallet, setPendingWallet] = useState<{api: any, address: string, key: string} | null>(null)

  // Check-in states
  const [checkinContract, setCheckinContract] = useState<any>(null)
  const [checkinStep, setCheckinStep] = useState<'choose' | 'review' | null>(null)
  const [checkinCustomMonths, setCheckinCustomMonths] = useState<number>(0)
  const [checkinUseCustom, setCheckinUseCustom] = useState(false)
  const [checkinLoading, setCheckinLoading] = useState(false)
  const [checkinTxCbor, setCheckinTxCbor] = useState<string | null>(null)
  const [checkinNewDeadlineSlot, setCheckinNewDeadlineSlot] = useState<string | null>(null)

  // Cancel states
  const [cancelContract, setCancelContract] = useState<any>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  const router = useRouter()
  const { walletApi, walletAddress, walletName, setWallet } = useWalletContext()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
      }
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
      }
    })

    setTimeout(() => {
      setWallets(getAvailableWallets())
    }, 500)

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (walletAddress) {
      loadContracts()
    }
  }, [walletAddress])

  useEffect(() => {
    if (walletAddress && user) {
      checkAndSaveWallet()
    }
  }, [walletAddress, user])

  const loadContracts = async () => {
    setLoadingContracts(true)
    const { data } = await supabase
      .from('contracts')
      .select('*, contract_recipients(*)')
      .eq('owner_address', walletAddress)
      .order('created_at', { ascending: false })
    setContracts(data || [])
    setLoadingContracts(false)
  }

  const handleConnect = async (walletKey: string) => {
    try {
      setConnecting(true)
      const { api, address } = await connectWallet(walletKey)

      const { data: userData } = await supabase
        .from('users')
        .select('wallet_address')
        .eq('email', user.email)
        .single()

      const existingWallet = userData?.wallet_address

      if (existingWallet && existingWallet !== address) {
        setPendingWallet({ api, address: existingWallet, key: walletKey })
        setConnecting(false)
        return
      }

      await supabase
        .from('users')
        .update({ wallet_address: address })
        .eq('email', user.email)

      setWallet(api, address, walletKey)
    } catch (e) {
      console.error(e)
      alert('Failed to connect wallet')
    } finally {
      setConnecting(false)
    }
  }

  const checkAndSaveWallet = async () => {
    const { data: userData } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('email', user.email)
      .single()

    const existingWallet = userData?.wallet_address

    if (existingWallet && existingWallet !== walletAddress) {
      setPendingWallet({ 
        api: walletApi, 
        address: existingWallet,
        key: walletName || '' 
      })
      return
    }

    await supabase
      .from('users')
      .update({ wallet_address: walletAddress })
      .eq('email', user.email)
  }

  const handleConfirmSwitch = async () => {
    if (!pendingWallet) return
    await supabase
      .from('users')
      .update({ wallet_address: walletAddress })
      .eq('email', user.email)
    setWallet(pendingWallet.api, walletAddress!, pendingWallet.key)
    setPendingWallet(null)
  }

  const openCheckin = (contract: any) => {
    setCheckinContract(contract)
    setCheckinCustomMonths(contract.checkin_interval_months)
    setCheckinUseCustom(false)
    setCheckinTxCbor(null)
    setCheckinNewDeadlineSlot(null)
    setCheckinStep('choose')
  }

  const closeCheckin = () => {
    setCheckinContract(null)
    setCheckinStep(null)
    setCheckinUseCustom(false)
    setCheckinTxCbor(null)
    setCheckinNewDeadlineSlot(null)
  }

  const handleGoToReview = async (useCustom: boolean) => {
    if (!checkinContract) return
    setCheckinLoading(true)
    try {
      const months = useCustom ? checkinCustomMonths : checkinContract.checkin_interval_months

      const res = await fetch('https://alb-deploy-production.up.railway.app/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerAddress: walletAddress,
          txHash: checkinContract.tx_hash,
          outputIndex: 0,
          newIntervalMonths: months,
        }),
      })

      const { txCbor, newDeadlineSlot, error } = await res.json()
      if (error) throw new Error(error)

      setCheckinTxCbor(txCbor)
      setCheckinNewDeadlineSlot(newDeadlineSlot)
      setCheckinUseCustom(useCustom)
      setCheckinStep('review')
    } catch (e: any) {
      alert(`Failed to prepare check-in: ${e.message}`)
    } finally {
      setCheckinLoading(false)
    }
  }

  const handleCheckinConfirm = async () => {
    if (!checkinContract || !walletApi || !checkinTxCbor || !checkinNewDeadlineSlot) return
    setCheckinLoading(true)
    try {
      const months = checkinUseCustom ? checkinCustomMonths : checkinContract.checkin_interval_months

      const signedTx = await walletApi.signTx(checkinTxCbor, true)

      const submitRes = await fetch('https://alb-deploy-production.up.railway.app/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txCbor: checkinTxCbor, witnessSet: signedTx, ownerAddress: walletAddress }),
      })

      const { txHash, error: submitError } = await submitRes.json()
      if (submitError) throw new Error(submitError)

      await supabase
        .from('contracts')
        .update({
          deadline_slot: checkinNewDeadlineSlot,
          checkin_interval_months: months,
          tx_hash: txHash,
        })
        .eq('id', checkinContract.id)

      closeCheckin()
      await loadContracts()
      alert(`✅ Check-in successful! TxHash: ${txHash}`)

    } catch (e: any) {
      console.error(e)
      if (e.message?.includes('no account') || e.message?.includes('locked')) {
        alert('Wallet is locked. Please unlock your wallet extension and try again.')
      } else {
        alert(`Check-in failed: ${e.message}`)
      }
    } finally {
      setCheckinLoading(false)
    }
  }

  const handleCancelConfirm = async () => {
    if (!cancelContract || !walletApi) return
    setCancelLoading(true)
    try {
      const res = await fetch('https://alb-deploy-production.up.railway.app/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerAddress: walletAddress,
          txHash: cancelContract.tx_hash,
          outputIndex: 0,
        }),
      })

      const { txCbor, error } = await res.json()
      if (error) throw new Error(error)

      const signedTx = await walletApi.signTx(txCbor, true)

      const submitRes = await fetch('https://alb-deploy-production.up.railway.app/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txCbor, witnessSet: signedTx, ownerAddress: walletAddress }),
      })

      const { txHash, error: submitError } = await submitRes.json()
      if (submitError) throw new Error(submitError)

      await supabase
        .from('contracts')
        .update({ status: 'cancelled', tx_hash: txHash })
        .eq('id', cancelContract.id)

      setCancelContract(null)
      await loadContracts()
      alert(`✅ Cancelled! TxHash: ${txHash}`)

    } catch (e: any) {
      console.error(e)
      if (e.message?.includes('no account') || e.message?.includes('locked')) {
        alert('Wallet is locked. Please unlock your wallet extension and try again.')
      } else {
        alert(`Cancel failed: ${e.message}`)
      }
    } finally {
      setCancelLoading(false)
    }
  }

  const intervals = [1, 2, 3, 6, 12, 24, 36, 60]

  if (!user) return (
    <main className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="text-white/40">Loading...</div>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#0a0f1e] text-white">

      {/* Switch Wallet Modal */}
      {pendingWallet && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0a0f1e] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4">
            <div className="text-2xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold mb-2">Switch Wallet?</h2>
            <p className="text-white/50 text-sm mb-2">Previously used:</p>
            <div className="bg-white/5 rounded-xl px-4 py-2 text-xs font-mono text-white/40 mb-3 break-all">
              {pendingWallet.address.slice(0, 30)}...
            </div>
            <p className="text-white/50 text-sm mb-2">New wallet:</p>
            <div className="bg-white/5 rounded-xl px-4 py-2 text-xs font-mono text-white/40 mb-4 break-all">
              {walletAddress?.slice(0, 30)}...
            </div>
            <p className="text-white/50 text-sm mb-6">
              If you switch, you will not see contracts from your old wallet.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingWallet(null)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-sm transition">
                Cancel
              </button>
              <button
                onClick={handleConfirmSwitch}
                className="flex-1 bg-blue-500 hover:bg-blue-400 text-white py-3 rounded-xl text-sm font-medium transition">
                Switch Wallet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelContract && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0a0f1e] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4">
            <div className="text-2xl mb-4">🚫</div>
            <h2 className="text-xl font-semibold mb-2">Cancel Contract?</h2>
            <p className="text-white/50 text-sm mb-6">
              This will return your ADA back to your wallet. This action cannot be undone.
            </p>
            <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Amount</span>
                <span className="font-bold text-green-400">{cancelContract.total_ada} ADA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Recipients</span>
                <span>{cancelContract.contract_recipients?.length} person{cancelContract.contract_recipients?.length > 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelContract(null)}
                disabled={cancelLoading}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-sm transition">
                Keep Contract
              </button>
              <button
                onClick={handleCancelConfirm}
                disabled={cancelLoading}
                className="flex-1 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium transition">
                {cancelLoading ? 'Processing...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check-in Modal */}
      {checkinStep && checkinContract && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0a0f1e] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4">

            {checkinStep === 'choose' && (
              <>
                <div className="text-2xl mb-4">✅</div>
                <h2 className="text-xl font-semibold mb-2">Check-in</h2>
                <p className="text-white/50 text-sm mb-6">
                  Current interval: <span className="text-white">{checkinContract.checkin_interval_months} months</span>
                </p>
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => handleGoToReview(false)}
                    disabled={checkinLoading}
                    className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium transition">
                    {checkinLoading ? 'Loading...' : `Same interval (${checkinContract.checkin_interval_months}m)`}
                  </button>
                  <button
                    onClick={() => setCheckinUseCustom(true)}
                    disabled={checkinLoading}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition ${
                      checkinUseCustom ? 'bg-blue-500 text-white' : 'bg-white/5 hover:bg-white/10 text-white/60'
                    }`}>
                    Custom
                  </button>
                </div>

                {checkinUseCustom && (
                  <div className="mb-4">
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {intervals.map((m) => (
                        <button
                          key={m}
                          onClick={() => setCheckinCustomMonths(m)}
                          className={`py-2 rounded-xl text-xs font-medium transition ${
                            checkinCustomMonths === m
                              ? 'bg-blue-500 text-white'
                              : 'bg-white/5 text-white/40 hover:bg-white/10'
                          }`}>
                          {m < 12 ? `${m}M` : `${m/12}Y`}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handleGoToReview(true)}
                      disabled={checkinLoading}
                      className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium transition mt-2">
                      {checkinLoading ? 'Loading...' : 'Next → Review'}
                    </button>
                  </div>
                )}

                <button
                  onClick={closeCheckin}
                  disabled={checkinLoading}
                  className="w-full bg-white/5 hover:bg-white/10 text-white/60 py-3 rounded-xl text-sm transition">
                  Cancel
                </button>
              </>
            )}

            {checkinStep === 'review' && (
              <>
                <div className="text-2xl mb-4">🔍</div>
                <h2 className="text-xl font-semibold mb-4">Review Check-in</h2>
                <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/40">Contract</span>
                    <span className="font-bold">{checkinContract.total_ada} ADA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">New interval</span>
                    <span>{checkinUseCustom ? checkinCustomMonths : checkinContract.checkin_interval_months} months</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">New deadline</span>
                    <span className="text-green-400">
                      {checkinNewDeadlineSlot 
                        ? formatDate(slotToDate(Number(checkinNewDeadlineSlot)))
                        : '-'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCheckinStep('choose')}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-sm transition">
                    Back
                  </button>
                  <button
                    onClick={handleCheckinConfirm}
                    disabled={checkinLoading}
                    className="flex-1 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium transition">
                    {checkinLoading ? 'Processing...' : 'Confirm Check-in'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      <nav className="border-b border-white/10 px-6 py-4 flex justify-between items-center">
        <span className="text-xl font-bold">ADA LastBlock</span>
        <div className="flex items-center gap-4">
          <span className="text-white/40 text-sm">{user.email}</span>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/')
            }}
            className="text-white/40 hover:text-white text-sm transition">
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">

        {!walletAddress ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center mb-8">
            <div className="text-4xl mb-4">👛</div>
            <h2 className="text-xl font-semibold mb-2">Connect your wallet</h2>
            <p className="text-white/40 text-sm mb-8">
              Connect your Cardano wallet to manage your contracts.
            </p>
            {wallets.length === 0 ? (
              <div className="text-white/30 text-sm">
                No Cardano wallet detected. Please install{' '}
                <a href="https://www.lace.io" target="_blank" className="text-blue-400 hover:underline">Lace</a>
                {' '}or{' '}
                <a href="https://eternl.io" target="_blank" className="text-blue-400 hover:underline">Eternl</a>.
              </div>
            ) : (
              <div className="flex gap-3 justify-center flex-wrap">
                {wallets.map((w) => (
                  <button
                    key={w.key}
                    onClick={() => handleConnect(w.key)}
                    disabled={connecting}
                    className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white px-6 py-3 rounded-full font-medium transition">
                    {connecting ? 'Connecting...' : `Connect ${w.name}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-6 py-4 flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-green-400 text-sm font-medium">
                {walletName?.charAt(0).toUpperCase()}{walletName?.slice(1)} connected
              </span>
              <span className="text-white/30 text-xs font-mono">
                {walletAddress?.slice(0, 12)}...{walletAddress?.slice(-6)}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">My Contracts</h1>
          {walletAddress && (
            <button
              onClick={() => router.push('/create')}
              className="bg-blue-500 hover:bg-blue-400 text-white px-6 py-3 rounded-full font-medium transition">
              + New Contract
            </button>
          )}
        </div>

        {loadingContracts ? (
          <div className="text-white/40 text-center py-16">Loading contracts...</div>
        ) : contracts.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-16 text-center">
            <div className="text-5xl mb-4">📦</div>
            <h2 className="text-xl font-semibold mb-2">No contracts yet</h2>
            <p className="text-white/40 mb-8">
              {walletAddress ? 'Create your first contract to get started.' : 'Connect your wallet first.'}
            </p>
            {walletAddress && (
              <button
                onClick={() => router.push('/create')}
                className="bg-blue-500 hover:bg-blue-400 text-white px-6 py-3 rounded-full font-medium transition">
                + New Contract
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {contracts.map((c) => {
              const deadline = slotToDate(Number(c.deadline_slot))
              const days = daysUntil(deadline)
              const isUrgent = days <= 7
              const isWarning = days <= 30

              return (
                <div key={c.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          c.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          c.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                          'bg-white/10 text-white/40'
                        }`}>
                          {c.status}
                        </span>
                      </div>
                      <div className="text-2xl font-bold">{c.total_ada} ADA</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${isUrgent ? 'text-red-400' : isWarning ? 'text-orange-400' : 'text-white/60'}`}>
                        {days > 0 ? `${days} days left` : 'Expired'}
                      </div>
                      <div className="text-white/30 text-xs mt-1">
                        Deadline: {formatDate(deadline)}
                      </div>
                    </div>
                  </div>

                  {c.contract_recipients?.length > 0 && (
                    <div className="mb-4">
                      <div className="text-white/40 text-xs uppercase tracking-widest mb-2">Recipients</div>
                      <div className="space-y-1">
                        {c.contract_recipients.map((r: any) => (
                          <div key={r.id} className="flex justify-between text-sm">
                            <span className="text-white/50 font-mono text-xs truncate max-w-[200px]">
                              {r.email || r.wallet_address?.slice(0, 16) + '...'}
                            </span>
                            <span className="text-white/60">{r.percent}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {c.status === 'active' && (
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => openCheckin(c)}
                        className="flex-1 bg-blue-500 hover:bg-blue-400 text-white py-2 rounded-xl text-sm font-medium transition">
                        Check-in
                      </button>
                      <button
                        onClick={() => setCancelContract(c)}
                        className="bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 px-4 py-2 rounded-xl text-sm transition">
                        Cancel
                      </button>
                    </div>
                  )}

                  <div className="mt-3 text-white/20 text-xs">
                    Tx: {c.tx_hash?.slice(0, 16)}...
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}