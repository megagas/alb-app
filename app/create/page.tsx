'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase'
import { useWalletContext } from '@/context/WalletContext'
import { hexToBech32 } from '@/utils/wallet'

type Recipient = {
  id: number
  address: string
  resolvedAddress: string | null
  resolvedEmail: string | null
  isLooking: boolean
  hasLooked: boolean
  percent: number
}

const isPreprod = process.env.NEXT_PUBLIC_NETWORK !== 'mainnet'

// หน่วยเป็น "เดือน" ปกติ แต่ 5min จะใช้ special value
const TEST_5MIN_VALUE = -1

export default function CreateContract() {
  const router = useRouter()
  const { walletApi, walletAddress } = useWalletContext()
  
  const [totalAda, setTotalAda] = useState<number>(0)
  const [intervalYears, setIntervalYears] = useState<number>(0)
  const [intervalMonths, setIntervalMonths] = useState<number>(2)
  const [showCustom, setShowCustom] = useState(false)
  const [isTest5Min, setIsTest5Min] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [recipients, setRecipients] = useState<Recipient[]>([
    { id: 1, address: '', resolvedAddress: null, resolvedEmail: null, isLooking: false, hasLooked: false, percent: 0 }
  ])

  const allocated = recipients.reduce((sum, r) => sum + r.percent, 0)
  const unallocated = 100 - allocated
  const totalIntervalMonths = isTest5Min ? 0 : (intervalYears * 12 + intervalMonths)
  // checkinInterval ที่ส่งไป server: 5min = 5*60 seconds ใส่เป็น "months" พิเศษ
  // server.mjs คูณ 30*24*60*60 ดังนั้นเราส่ง fraction ไม่ได้
  // แก้โดยส่ง checkinIntervalSeconds แทนเมื่อเป็น test mode
  const checkinIntervalForServer = isTest5Min ? 0.000347 : totalIntervalMonths
  // 5min = 300s, 1 month = 2592000s, 300/2592000 = 0.000115... 
  // ง่ายกว่า: ส่ง seconds โดยตรง และแก้ server รับ seconds แทน months เมื่อ isTest=true
  // แต่เพื่อไม่แก้ server — ส่ง checkinInterval เป็น seconds หารด้วย (30*24*60*60)
  // 300 / 2592000 ≈ 0.0001157 → BigInt จะ round เป็น 0n → ใช้ไม่ได้
  // ✅ วิธีที่ดีที่สุด: เพิ่ม field `checkinIntervalSeconds` ใน server และรับใน deploy endpoint

  const intervals = [
    { label: '1M', value: 1 },
    { label: '3M', value: 3 },
    { label: '6M', value: 6 },
    { label: '1Y', value: 12 },
    { label: '2Y', value: 24 },
    { label: '3Y', value: 36 },
    { label: '5Y', value: 60 },
  ]

  const lookupRecipient = async (id: number, value: string) => {
    if (!value) return
    setRecipients(prev => prev.map(r => r.id === id ? { ...r, isLooking: true } : r))
    const isEmail = value.includes('@')
    const { data } = await supabase
      .from('users')
      .select('email, wallet_address, name')
      .eq(isEmail ? 'email' : 'wallet_address', value)
      .single()
    setRecipients(prev => prev.map(r => r.id === id ? {
      ...r,
      isLooking: false,
      hasLooked: true,
      resolvedAddress: isEmail ? (data?.wallet_address ? hexToBech32(data.wallet_address) : null) : value,
      resolvedEmail: isEmail ? value : (data?.email || null),
    } : r))
  }

  const updatePercent = (id: number, value: number) => {
    setRecipients(prev => {
      const current = prev.find(r => r.id === id)!
      const diff = value - current.percent
      if (diff > 0 && diff > unallocated) return prev
      if (value < 0) return prev
      return prev.map(r => r.id === id ? { ...r, percent: value } : r)
    })
  }

  const addRecipient = () => {
    if (recipients.length >= 5) return
    setRecipients(prev => [...prev, {
      id: Date.now(),
      address: '',
      resolvedAddress: null,
      resolvedEmail: null,
      isLooking: false,
      hasLooked: false,
      percent: 0
    }])
  }

  const removeRecipient = (id: number) => {
    if (recipients.length === 1) return
    setRecipients(prev => prev.filter(r => r.id !== id))
  }

  const handleDeploy = async () => {
    if (!walletApi || !walletAddress) {
      alert('Please connect your wallet first')
      return
    }
    try {
      const res = await fetch('https://alb-deploy-production.up.railway.app/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerAddress: walletAddress,
          recipients: recipients.map(r => ({
            address: r.resolvedAddress || r.address,
            percent: r.percent,
          })),
          totalAda,
          checkinInterval: totalIntervalMonths,
          // ✅ ส่ง seconds โดยตรงเมื่อเป็น test mode — server จะใช้ค่านี้แทน
          ...(isTest5Min && { checkinIntervalSeconds: 300 }),
        }),
      })

      const { txCbor, error, scriptAddress, deadlineSlot, nowSlot } = await res.json()
      if (error) throw new Error(error)

      const signedTx = await walletApi.signTx(txCbor, true)

      const submitRes = await fetch('https://alb-deploy-production.up.railway.app/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txCbor, witnessSet: signedTx, ownerAddress: walletAddress }),
      })
      const { txHash, error: submitError } = await submitRes.json()
      if (submitError) throw new Error(submitError)

      const { data: contractData } = await supabase.from('contracts').insert({
        owner_address: walletAddress,
        script_address: scriptAddress,
        tx_hash: txHash,
        total_ada: totalAda,
        checkin_interval_months: isTest5Min ? 0 : totalIntervalMonths,
        deadline_slot: deadlineSlot,
        last_checkin_slot: nowSlot,
        status: 'active',
      }).select().single()

      if (contractData) {
        await supabase.from('contract_recipients').insert(
          recipients.map(r => ({
            contract_id: contractData.id,
            wallet_address: r.resolvedAddress || r.address,
            email: r.resolvedEmail || null,
            percent: r.percent,
          }))
        )
      }

      alert(`🎉 Deployed! TxHash: ${txHash}`)
      router.push('/dashboard')

    } catch (e: any) {
      console.error(e)
      if (e.message?.includes('no account') || e.message?.includes('locked')) {
        alert('Wallet is locked. Please unlock your wallet extension and try again.')
      } else {
        alert(`Deploy failed: ${e.message}`)
      }
    }
  }

  const canDeploy = unallocated === 0 &&
    totalAda >= 10 &&
    (isTest5Min || totalIntervalMonths >= 1) &&
    recipients.every(r => r.resolvedAddress || (!r.address.includes('@') && r.address.length > 10))

  const intervalLabel = isTest5Min
    ? '5 minutes'
    : `${intervalYears > 0 ? `${intervalYears} year${intervalYears > 1 ? 's' : ''} ` : ''}${intervalMonths > 0 ? `${intervalMonths} month${intervalMonths > 1 ? 's' : ''}` : ''}` || '—'

  return (
    <main className="min-h-screen bg-[#0a0f1e] text-white">

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0a0f1e] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4">
            <div className="text-2xl mb-4">🔒</div>
            <h2 className="text-xl font-semibold mb-4">Confirm Deploy</h2>
            {isTest5Min && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2 mb-4 text-yellow-400 text-xs">
                ⚡ Test mode — deadline in 5 minutes
              </div>
            )}
            <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Amount</span>
                <span className="font-bold">{totalAda} ADA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Check-in every</span>
                <span>{intervalLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Recipients</span>
                <span>{recipients.length} person{recipients.length > 1 ? 's' : ''}</span>
              </div>
              <div className="border-t border-white/10 pt-2 mt-2 space-y-2">
                {recipients.map((r) => (
                  <div key={r.id} className="flex justify-between items-center text-xs">
                    <span className="text-white/40 truncate max-w-[180px]">
                      {r.resolvedEmail || r.resolvedAddress?.slice(0, 16) || r.address.slice(0, 16)}...
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-white/30">{r.percent}%</span>
                      <span className="text-blue-400 font-bold">
                        {((totalAda * r.percent) / 100).toFixed(2)} ADA
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-sm transition">
                Cancel
              </button>
              <button
                onClick={() => { setShowConfirm(false); handleDeploy() }}
                className="flex-1 bg-blue-500 hover:bg-blue-400 text-white py-3 rounded-xl text-sm font-medium transition">
                Confirm Deploy
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="border-b border-white/10 px-6 py-4 flex justify-between items-center">
        <span className="text-xl font-bold">ADA LastBlock</span>
        <button onClick={() => router.push('/dashboard')} className="text-white/40 hover:text-white text-sm transition">
          ← Back to dashboard
        </button>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Create Contract</h1>
        <p className="text-white/40 mb-10">Set up your ADA LastBlock contract.</p>

        {!walletAddress && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 mb-6 text-center">
            <p className="text-orange-400 text-sm">⚠️ Please connect your wallet on the dashboard first</p>
          </div>
        )}

        {/* Total ADA */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <label className="text-sm text-white/60 uppercase tracking-widest mb-3 block">
            Total ADA to lock
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={10}
              value={totalAda || ''}
              onChange={(e) => setTotalAda(Number(e.target.value))}
              placeholder="e.g. 1000"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xl font-bold outline-none focus:border-blue-500 transition"
            />
            <span className="text-white/40 text-lg">ADA</span>
          </div>
          {totalAda > 0 && totalAda < 10 ? (
            <p className="text-red-400 text-xs mt-2">⚠️ Minimum 10 ADA</p>
          ) : (
            <p className="text-white/30 text-xs mt-2">Minimum 10 ADA</p>
          )}
        </div>

        {/* Check-in interval */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <label className="text-sm text-white/60 uppercase tracking-widest mb-3 block">
            Check-in interval
          </label>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {intervals.map((item) => (
              <button
                key={item.value}
                onClick={() => {
                  setShowCustom(false)
                  setIsTest5Min(false)
                  setIntervalYears(Math.floor(item.value / 12))
                  setIntervalMonths(item.value % 12)
                }}
                className={`py-3 rounded-xl text-sm font-medium transition ${
                  !showCustom && !isTest5Min && totalIntervalMonths === item.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => { setShowCustom(true); setIsTest5Min(false) }}
              className={`py-3 rounded-xl text-sm font-medium transition ${
                showCustom ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'
              }`}
            >
              Custom
            </button>

            {/* ✅ ปุ่ม 5min — แสดงเฉพาะ preprod */}
            {isPreprod && (
              <button
                onClick={() => { setIsTest5Min(true); setShowCustom(false) }}
                className={`col-span-4 py-2 rounded-xl text-xs font-medium transition border ${
                  isTest5Min
                    ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
                    : 'bg-white/5 border-white/10 text-white/20 hover:text-yellow-400 hover:border-yellow-500/30'
                }`}
              >
                ⚡ 5 min (testnet only)
              </button>
            )}
          </div>

          {showCustom && (
            <div className="flex items-center gap-3 mt-2">
              <select
                value={intervalYears}
                onChange={(e) => setIntervalYears(Number(e.target.value))}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
              >
                {Array.from({ length: 11 }, (_, i) => (
                  <option key={i} value={i} className="bg-[#0a0f1e]">{i} yr</option>
                ))}
              </select>
              <select
                value={intervalMonths}
                onChange={(e) => setIntervalMonths(Number(e.target.value))}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i} className="bg-[#0a0f1e]">{i} mo</option>
                ))}
              </select>
            </div>
          )}

          <p className="text-white/30 text-xs mt-3">
            Check-in every {intervalLabel}
          </p>
        </div>

        {/* Pool */}
        <div className={`rounded-2xl p-6 mb-6 border ${
          unallocated === 0
            ? 'bg-green-500/10 border-green-500/20'
            : 'bg-white/5 border-white/10'
        }`}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-white/60 uppercase tracking-widest mb-1">Unallocated</div>
              <div className={`text-4xl font-bold ${unallocated === 0 ? 'text-green-400' : 'text-white'}`}>
                {unallocated}%
              </div>
              {totalAda > 0 && (
                <div className="text-white/30 text-sm mt-1">
                  = {((totalAda * unallocated) / 100).toFixed(2)} ADA remaining
                </div>
              )}
            </div>
            {unallocated === 0 && (
              <div className="text-green-400 text-sm">✓ Fully allocated</div>
            )}
          </div>
          <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${allocated}%` }}
            />
          </div>
        </div>

        {/* Recipients */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <label className="text-sm text-white/60 uppercase tracking-widest mb-4 block">
            Recipients
          </label>

          <div className="space-y-6">
            {recipients.map((r) => (
              <div key={r.id} className="border border-white/10 rounded-xl p-4">
                <div className="mb-4">
                  <input
                    type="text"
                    value={r.address}
                    onChange={(e) => setRecipients(prev => prev.map(p => p.id === r.id ? {
                      ...p,
                      address: e.target.value,
                      resolvedAddress: null,
                      resolvedEmail: null,
                      hasLooked: false,
                    } : p))}
                    onBlur={(e) => lookupRecipient(r.id, e.target.value)}
                    placeholder="Wallet address or email"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 transition"
                  />

                  {r.isLooking && (
                    <div className="text-white/30 text-xs mt-2">Looking up...</div>
                  )}

                  {!r.isLooking && r.resolvedAddress && (
                    <div className="mt-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                      <div className="text-green-400 text-xs mb-1">✓ Found</div>
                      <div className="text-white/60 text-xs font-mono truncate">{r.resolvedAddress}</div>
                      {r.resolvedEmail && <div className="text-white/40 text-xs">{r.resolvedEmail}</div>}
                    </div>
                  )}

                  {!r.isLooking && r.hasLooked && r.address && !r.resolvedAddress && (
                    <div className="mt-2 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                      <div className="text-orange-400 text-xs">
                        {r.address.includes('@')
                          ? '⚠️ Email not found — ask them to sign up first'
                          : '⚠️ Address not in system — will use directly'}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={r.percent}
                    onChange={(e) => updatePercent(r.id, Number(e.target.value))}
                    className="flex-1 accent-blue-500"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={r.percent}
                      onChange={(e) => updatePercent(r.id, Math.min(100, Number(e.target.value)))}
                      className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-sm text-center outline-none focus:border-blue-500"
                    />
                    <span className="text-white/40 text-sm">%</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-white/30 text-xs">
                    = {totalAda ? ((totalAda * r.percent) / 100).toFixed(2) : '0'} ADA
                  </span>
                  {recipients.length > 1 && (
                    <button
                      onClick={() => removeRecipient(r.id)}
                      className="text-red-400/60 hover:text-red-400 text-xs transition">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {recipients.length < 5 && (
            <button
              onClick={addRecipient}
              className="mt-4 w-full border border-dashed border-white/20 rounded-xl py-3 text-white/40 hover:text-white hover:border-white/40 text-sm transition">
              + Add recipient
            </button>
          )}
        </div>

        {/* Deploy button */}
        <button
          onClick={() => setShowConfirm(true)}
          disabled={!canDeploy || !walletAddress}
          className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-30 disabled:cursor-not-allowed text-white py-4 rounded-full text-lg font-semibold transition">
          {!walletAddress ? 'Connect wallet first' : 'Deploy Contract'}
        </button>

        {unallocated !== 0 && (
          <p className="text-center text-orange-400 text-sm mt-3">
            Allocate all 100% before deploying
          </p>
        )}
      </div>
    </main>
  )
}