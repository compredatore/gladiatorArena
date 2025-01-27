export const createWebSocketConnection = (onMessage: (data: string) => void) => {
    const socket = new WebSocket('ws://localhost:8000/stream'); 
    socket.onopen = () => {
        console.log('WebSocket connection established.');
    };
    socket.onmessage = (event) => {
        onMessage(event.data);
    };
    socket.onclose = () => {
        console.log('WebSocket connection closed.');
    };
    return socket;
};