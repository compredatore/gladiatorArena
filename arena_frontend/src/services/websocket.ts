export const createWebSocketConnection = (onMessage: (data: any) => void) => {
    const socket = new WebSocket('ws://localhost:8000/stream');
    
    socket.onopen = () => {
        console.log('WebSocket connection established.');
    };
    
    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            onMessage(data);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };
    
    socket.onclose = () => {
        console.log('WebSocket connection closed.');
    };
    
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    return socket;
};