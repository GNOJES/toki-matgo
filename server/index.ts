import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { RoomService, type Envelope, type Room } from './rooms';
import type { PlayerId } from '../src/game-engine/types';
export function startServer(port = Number(process.env.PORT ?? 3002)) {
  const origins = (
    process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000,http://127.0.0.1:3000'
  ).split(',');
  const http = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  const io = new Server(http, {
    cors: { origin: origins },
    maxHttpBufferSize: 16384,
    allowRequest: (req, callback) =>
      callback(null, !req.headers.origin || origins.includes(req.headers.origin)),
  });
  const service = new RoomService();
  function broadcast(room: Room, events: unknown[] = []) {
    room.sessions.forEach((s, id) => {
      if (s?.socketId)
        io.to(s.socketId).emit('room:state', { ...service.snapshot(room, id as PlayerId), events });
    });
  }
  io.on('connection', (socket) => {
    let membership: { room: Room; player: PlayerId } | null = null;
    let calls = 0;
    let windowStart = Date.now();
    function guard() {
      if (Date.now() - windowStart > 60000) {
        calls = 0;
        windowStart = Date.now();
      }
      if (++calls > 120) throw Error('요청이 너무 많아요. 잠시 기다려주세요.');
    }
    function requireMember() {
      guard();
      if (!membership || membership.room.sessions[membership.player]?.socketId !== socket.id)
        throw Error('방에 다시 연결해주세요.');
      return membership;
    }
    socket.on('room:enter', (data: unknown, ack: (value: unknown) => void) => {
      try {
        guard();
        if (!data || typeof data !== 'object') throw Error('입장 정보 오류');
        const d = data as Record<string, unknown>;
        if (typeof d.nickname !== 'string' || d.nickname.length > 100)
          throw Error('이름을 입력해주세요.');
        if (d.code !== undefined && (typeof d.code !== 'string' || !/^[A-Z2-9]{6}$/.test(d.code)))
          throw Error('방 코드 6자리를 확인해주세요.');
        if (d.token !== undefined && (typeof d.token !== 'string' || d.token.length !== 64))
          throw Error('참가 정보 오류');
        if (membership) {
          service.disconnect(membership.room, membership.player, socket.id);
          broadcast(membership.room);
        }
        const entered = d.code
          ? service.join(d.code as string, d.nickname, socket.id, d.token as string | undefined)
          : service.create(d.nickname, socket.id);
        membership = { room: entered.room, player: entered.player };
        if (
          'previousSocket' in entered &&
          typeof entered.previousSocket === 'string' &&
          entered.previousSocket &&
          entered.previousSocket !== socket.id
        )
          io.sockets.sockets.get(entered.previousSocket)?.disconnect(true);
        ack({ ok: true, token: entered.token, code: entered.room.code });
        broadcast(entered.room);
      } catch (error) {
        ack({ ok: false, error: error instanceof Error ? error.message : '입장 실패' });
      }
    });
    socket.on('game:action', (data: Envelope, ack: (value: unknown) => void) => {
      try {
        const { room, player } = requireMember();
        if (
          !data ||
          typeof data !== 'object' ||
          !data.action ||
          typeof data.action !== 'object' ||
          !['PLAY_CARD', 'SELECT_FLOOR', 'BOMB', 'PASS', 'GO', 'STOP', 'SET_KUKJIN'].includes(
            data.action.type,
          )
        )
          throw Error('잘못된 행동입니다.');
        const events = service.action(room, player, data);
        ack({ ok: true, sequence: room.sessions[player]!.sequence });
        broadcast(room, events);
      } catch (error) {
        ack({ ok: false, error: error instanceof Error ? error.message : '행동 실패' });
        if (membership)
          socket.emit('room:state', {
            ...service.snapshot(membership.room, membership.player),
            events: [],
          });
      }
    });
    socket.on('game:ready', (version: number) => {
      try {
        const { room, player } = requireMember();
        service.ready(room, player, version);
        broadcast(room);
      } catch {}
    });
    socket.on('game:next', (_, ack: (value: unknown) => void) => {
      try {
        const { room, player } = requireMember();
        service.nextRound(room, player);
        ack({ ok: true });
        broadcast(room);
      } catch (error) {
        ack({ ok: false, error: error instanceof Error ? error.message : '다음 판 실패' });
      }
    });
    socket.on('room:leave', () => {
      if (membership) {
        service.disconnect(membership.room, membership.player, socket.id);
        broadcast(membership.room);
        membership = null;
      }
    });
    socket.on('disconnect', () => {
      if (membership) {
        service.disconnect(membership.room, membership.player, socket.id);
        broadcast(membership.room);
      }
    });
  });
  const cleanup = setInterval(() => service.cleanup(), 60000);
  cleanup.unref();
  http.listen(port, '0.0.0.0', () => console.log(`맞고 realtime server :${port}`));
  return {
    io,
    http,
    service,
    close: () => {
      clearInterval(cleanup);
      io.close();
      http.close();
    },
  };
}
if (process.env.VITEST !== 'true') startServer();
