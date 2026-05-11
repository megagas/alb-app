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
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [wallets, setWallets] = useState<any[]>([])
  const [connecting, setConnecting] = useState(false)
  const [contracts, setContracts] = useState<any[]>([])
  const [loadingContracts, setLoadingContracts] = useState(false)
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

  const loadContracts = async () => {
    setLoadingContracts(true)
    const { data, error } = await supabase
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

    // เช็ค wallet เดิมใน Supabase
    const { data: userData } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('email', user.email)
      .single()

    const existingWallet = userData?.wallet_address
    console.log('existing:', existingWallet)
    console.log('new:', address)
    console.log('match:', existingWallet === address)

    if (existingWallet && existingWallet !== address) {
      // มี wallet เดิม และต่างกัน → เตือน
      const confirmed = window.confirm(
  `⚠️ You previously used wallet:\n${existingWallet.slice(0, 20)}...\n\n` +
  `New wallet:\n${address.slice(0, 20)}...\n\n` +
  `If you switch, you will not see contracts from your old wallet.\nProceed?`
)
      if (!confirmed) {
        setConnecting(false)
        return
      }
    }

    // Save wallet_address ลง Supabase
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

  if (!user) return (
    <main className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <div className="text-white/40">Loading...</div>
    </main>
  )

  return (
    <main className="min-h-screen bg-[#0a0f1e] text-white">
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

        {/* Wallet Connect */}
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

        {/* Contracts */}
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

                  {/* Recipients */}
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

                  {/* Actions */}
                  {c.status === 'active' && (
                    <div className="flex gap-3 mt-4">
                      <button className="flex-1 bg-blue-500 hover:bg-blue-400 text-white py-2 rounded-xl text-sm font-medium transition">
                        Check-in
                      </button>
                      <button className="bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-4 py-2 rounded-xl text-sm transition">
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