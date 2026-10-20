export const initials = (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2)
export const messageTime = (value: string) => new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
