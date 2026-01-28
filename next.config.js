/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/index.html',
        has: [{ type: 'header', key: 'accept', value: '(.*text/html.*)' }]
      }
    ]
  }
}
module.exports = nextConfig