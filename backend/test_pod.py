import asyncio
import httpx
import websockets
import json

async def run():
    async with httpx.AsyncClient(base_url='http://127.0.0.1:8000') as client:
        # Register user
        reg_res = await client.post('/api/v1/auth/register', json={
            'email': 'test_pod6@example.com',
            'password': 'password123',
            'full_name': 'Test Pod',
            'role': 'EDUCATOR'
        })
        
        # Login
        login_res = await client.post('/api/v1/auth/login', data={
            'username': 'test_pod6@example.com',
            'password': 'password123'
        })
        token = login_res.json()['access_token']
        headers = {'Authorization': f'Bearer {token}'}
        
        # Create course
        course_res = await client.post('/api/v1/courses', headers=headers, json={
            'title': 'Test Course',
            'description': 'Test',
            'category': 'STEM',
            'code': 'TEST103'
        })
        course_id = course_res.json()['id']
        
        # Create pod
        pod_res = await client.post('/api/v1/pods', headers=headers, json={
            'title': 'Test Pod Session',
            'course_id': course_id,
            'max_participants': 10,
            'topic': 'Testing WebRTC'
        })
        if pod_res.status_code != 200 and pod_res.status_code != 201:
            print('Pod failed:', pod_res.text)
            return
        pod_id = pod_res.json()['id']
        print(f"Pod created: {pod_id}")
        
        # Try to connect via websocket
        ws_url = f'ws://127.0.0.1:8000/api/v1/pods/ws/{pod_id}?client_id=client_123&token={token}'
        print(f'Connecting to websocket... {ws_url}')
        try:
            async with websockets.connect(ws_url) as ws:
                print('Connected successfully!')
                msg = await ws.recv()
                print('Received:', msg)
                await asyncio.sleep(1)
                await ws.close()
                print('Closed gracefully.')
        except Exception as e:
            print('Websocket connection failed:', str(e))

asyncio.run(run())
