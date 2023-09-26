import dayjs from 'dayjs'

export const log = (pkgName: string, msg: string) => {
  console.log(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')} ${pkgName}]:${msg}`)
}

export const error = (pkgName: string, msg: string) => {
  console.error(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')} ${pkgName}]:${msg}`)
}

export const warn = (pkgName: string, msg: string) => {
  console.warn(`[${dayjs().format('YYYY-MM-DD HH:mm:ss')} ${pkgName}]:${msg}`)
}

export const getCustomComsole = (pkgName: string) => {
  return {
    log: (msg: string) => log(pkgName, msg),
    error: (msg: string) => error(pkgName, msg),
    warn: (msg: string) => warn(pkgName, msg)
  }
}
