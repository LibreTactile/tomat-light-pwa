class Utils {
  static async getPublicIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Failed to get public IP, using fallback:', error);
      return 'local-fallback-ip';
    }
  }

  static log(message) {
    console.log(`[WebRTC Navigator] ${message}`);
  }
}