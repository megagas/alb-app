'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { connectWallet } from '@/utils/wallet'

type WalletContextType = {
  walletApi: any
  walletAddress: string | null
  walletName: string | null
  setWallet: (api: any, address: string, name: string) => void
  disconnect: () => void
}

const WalletContext = createContext<WalletContextType | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletApi, setWalletApi] = useState<any>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletName, setWalletName] = useState<string | null>(null)

  useEffect(() => {
  const saved = localStorage.getItem('walletName')
  const path = window.location.pathname
  if (saved && (path === '/dashboard' || path === '/create')) {
    connectWallet(saved).then(({ api, address }) => {
      setWalletApi(api)
      setWalletAddress(address)
      setWalletName(saved)
    }).catch(() => {
      localStorage.removeItem('walletName')
    })
  }
}, [])

  const setWallet = (api: any, address: string, name: string) => {
    setWalletApi(api)
    setWalletAddress(address)
    setWalletName(name)
    localStorage.setItem('walletName', name)
  }

  const disconnect = () => {
    setWalletApi(null)
    setWalletAddress(null)
    setWalletName(null)
    localStorage.removeItem('walletName')
  }

  return (
    <WalletContext.Provider value={{ walletApi, walletAddress, walletName, setWallet, disconnect }}>
      {children}
    </WalletContext.Provider>
  )
}

export const useWalletContext = () => {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWalletContext must be used within WalletProvider')
  return ctx
}