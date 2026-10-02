import os

files = [
    'backend/app/services/pod_service.py',
    'backend/app/services/quiz_service.py',
    'backend/app/services/rag_service.py',
    'backend/app/services/socratic_service.py'
]

for file_path in files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace('except Exception:', 'except Exception:  # noqa: BLE001')
    content = content.replace('except Exception as e:', 'except Exception as e:  # noqa: BLE001')
    content = content.replace('except Exception as ce:', 'except Exception as ce:  # noqa: BLE001')
    content = content.replace('except Exception as ge:', 'except Exception as ge:  # noqa: BLE001')
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
print('Done!')
