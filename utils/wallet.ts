// CIP-30 Wallet Connector
export const getAvailableWallets = () => {
  if (typeof window === 'undefined') return []
  
  const wallets = []
  if ((window as any).cardano?.lace) wallets.push({ name: 'Lace', key: 'lace' })
  if ((window as any).cardano?.eternl) wallets.push({ name: 'Eternl', key: 'eternl' })
  if ((window as any).cardano?.nami) wallets.push({ name: 'Nami', key: 'nami' })
  if ((window as any).cardano?.flint) wallets.push({ name: 'Flint', key: 'flint' })
  
  return wallets
}

// แปลง hex address เป็น bech32
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

function toBech32(prefix: string, data: Uint8Array): string {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
  const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

  function polymod(values: number[]): number {
    let chk = 1
    for (const v of values) {
      const top = chk >> 25
      chk = ((chk & 0x1ffffff) << 5) ^ v
      for (let i = 0; i < 5; i++) {
        if ((top >> i) & 1) chk ^= GENERATOR[i]
      }
    }
    return chk
  }

  function hrpExpand(hrp: string): number[] {
    const ret = []
    for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5)
    ret.push(0)
    for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31)
    return ret
  }

  function convertbits(data: Uint8Array, frombits: number, tobits: number, pad: boolean): number[] {
    let acc = 0, bits = 0
    const ret: number[] = []
    const maxv = (1 << tobits) - 1
    for (const value of data) {
      acc = (acc << frombits) | value
      bits += frombits
      while (bits >= tobits) {
        bits -= tobits
        ret.push((acc >> bits) & maxv)
      }
    }
    if (pad && bits > 0) ret.push((acc << (tobits - bits)) & maxv)
    return ret
  }

  const words = convertbits(data, 8, 5, true)
  const hrpExpanded = hrpExpand(prefix)
  const checksumInput = [...hrpExpanded, ...words, 0, 0, 0, 0, 0, 0]
  const chk = polymod(checksumInput) ^ 1
  const checksum = []
  for (let i = 0; i < 6; i++) checksum.push((chk >> (5 * (5 - i))) & 31)
  
  return prefix + '1' + [...words, ...checksum].map(x => CHARSET[x]).join('')
}

export function hexToBech32(hexAddress: string): string {
  if (hexAddress.startsWith('addr')) return hexAddress
  const bytes = hexToBytes(hexAddress)
  return toBech32('addr_test', bytes)
}

export const connectWallet = async (walletKey: string) => {
  try {
    const api = await (window as any).cardano[walletKey].enable()
    const hexAddress = await api.getChangeAddress()
        
    const bytes = hexToBytes(hexAddress)
    // preprod ใช้ prefix 'addr_test', mainnet ใช้ 'addr'
    const address = toBech32('addr_test', bytes)
    
    return { api, address }
  } catch (e) {
    console.error('connectWallet error:', e)
    throw e
  }
}