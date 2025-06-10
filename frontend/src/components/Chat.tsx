import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { ChatMessage } from '../types';

interface ChatProps {
  isMinimized: boolean;
  onToggleMinimize: () => void;
}

const Chat: React.FC<ChatProps> = ({ isMinimized, onToggleMinimize }) => {
  const { socket, gameState, currentPlayerId, currentPlayerUuid } = useSocket();
  const [message, setMessage] = useState<string>('');
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const prevChatLength = useRef<number>(gameState?.chat.length ?? 0);
  const prevIsMinimized = useRef<boolean>(isMinimized);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track unread messages
  useEffect(() => {
    if (!gameState) return;
    // If chat is minimized and new non-system messages arrive, increment unread count (ignore messages sent by current user and system messages)
    if (isMinimized && gameState.chat.length > prevChatLength.current) {
      const newMessages = gameState.chat.slice(prevChatLength.current);
      const newUnread = newMessages.filter(
        (msg) => msg.playerId !== currentPlayerUuid && msg.playerId !== ""
      ).length;
      setUnreadCount((count) => count + newUnread);
    }
    // If chat is opened, reset unread count
    if (!isMinimized && prevIsMinimized.current) {
      setUnreadCount(0);
    }
    prevChatLength.current = gameState.chat.length;
    prevIsMinimized.current = isMinimized;
  }, [gameState?.chat.length, isMinimized, currentPlayerUuid]);

  // Scroll chat container to bottom when new messages arrive and chat is open
  useEffect(() => {
    if (!isMinimized && messagesEndRef.current && gameState) {
      // Only scroll if the latest message is not a system message
      const lastMsg = gameState.chat[gameState.chat.length - 1];
      if (lastMsg && lastMsg.playerId !== "") {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [gameState?.chat.length, isMinimized]);

  const handleSendMessage = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!socket || !message.trim()) return;

    socket.emit('send-message', message.trim());
    setMessage('');
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!gameState) return null;

  return (
    <div className={`bg-white rounded-3xl shadow-lg transition-all duration-300 ${
      isMinimized ? 'h-12' : 'h-80'
    } w-full min-w-[250px]`}>
      <div
        className="flex items-center justify-between p-3 bg-blue-500 text-white rounded-t-3xl cursor-pointer"
        onClick={onToggleMinimize}
      >
        <div className="flex items-center space-x-2">
          <span>💬</span>
          <span className="font-medium">Chat</span>
          {unreadCount > 0 && (
            <span className="bg-blue-400 text-xs px-2 py-1 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <span className="text-lg">
          {isMinimized ? '▲' : '▼'}
        </span>
      </div>

      {!isMinimized && (
        <>
          <div className="h-48 overflow-y-auto p-3 space-y-2">
            {gameState.chat.length === 0 ? (
              <div className="text-center text-gray-500 text-sm mt-8">
                <span>💭</span>
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              gameState.chat.map((msg: ChatMessage) =>
                msg.playerId === "" ? (
                  <div
                    key={msg.id}
                    className="flex w-full justify-center"
                  >
                    <div className="text-xs italic text-gray-500 text-center w-full" style={{ fontSize: '0.85rem' }}>
                      {msg.message}
                    </div>
                  </div>
                ) : (
                  <div
                    key={msg.id}
                    className={`flex w-full ${msg.playerId === currentPlayerUuid ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-3 py-2 rounded-2xl shadow ${
                        msg.playerId === currentPlayerUuid
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-gray-200 text-gray-800 rounded-bl-none'
                      }`}
                    >
                      <div className="text-xs opacity-75 mb-1 text-right">
                        {msg.playerId === currentPlayerUuid ? `You` : `${msg.playerName}` +
                        ` • ${formatTime(msg.timestamp)}`}
                      </div>
                      <div>{msg.message}</div>
                    </div>
                  </div>
                )
              )
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 border-t">
            <div className="flex space-x-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                maxLength={200}
              />
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default Chat;
