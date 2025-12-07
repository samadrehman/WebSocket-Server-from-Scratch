// Demo application logic
document.addEventListener('DOMContentLoaded', function() {
    // Handle POST form submission
    const postForm = document.getElementById('postForm');
    const postResult = document.getElementById('postResult');
    
    if (postForm) {
        postForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(postForm);
            const data = Object.fromEntries(formData.entries());
            
            try {
                const response = await fetch('/api/data', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams(data)
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await response.text();
                    throw new Error(`Expected JSON but got: ${contentType}. Response: ${text.substring(0, 100)}`);
                }
                
                const result = await response.json();
                postResult.textContent = JSON.stringify(result, null, 2);
            } catch (error) {
                postResult.textContent = 'Error: ' + error.message;
                console.error('POST request error:', error);
            }
        });
    }
    
    // Test server function
    window.testServer = async function() {
        console.log('🧪 Testing server endpoints...');
        
        try {
            // Test GET /api/data
            console.log('Testing GET /api/data...');
            const getResponse = await fetch('/api/data');
            if (!getResponse.ok) {
                throw new Error(`GET /api/data failed: ${getResponse.status}`);
            }
            const contentType = getResponse.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await getResponse.text();
                throw new Error(`Expected JSON but got: ${contentType}. Response: ${text.substring(0, 100)}`);
            }
            const getData = await getResponse.json();
            console.log('GET response:', getData);
            
            // Test GET /api/evolution
            console.log('Testing GET /api/evolution...');
            const evolutionResponse = await fetch('/api/evolution');
            if (!evolutionResponse.ok) {
                throw new Error(`GET /api/evolution failed: ${evolutionResponse.status}`);
            }
            const evolutionContentType = evolutionResponse.headers.get('content-type');
            if (!evolutionContentType || !evolutionContentType.includes('application/json')) {
                const text = await evolutionResponse.text();
                throw new Error(`Expected JSON but got: ${evolutionContentType}. Response: ${text.substring(0, 100)}`);
            }
            const evolutionData = await evolutionResponse.json();
            console.log('Evolution API:', evolutionData);
            
            // Test POST /api/data
            console.log('Testing POST /api/data...');
            const postResponse = await fetch('/api/data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ 
                    test: 'Hello Server!',
                    timestamp: new Date().toISOString()
                })
            });
            if (!postResponse.ok) {
                throw new Error(`POST /api/data failed: ${postResponse.status}`);
            }
            const postContentType = postResponse.headers.get('content-type');
            if (!postContentType || !postContentType.includes('application/json')) {
                const text = await postResponse.text();
                throw new Error(`Expected JSON but got: ${postContentType}. Response: ${text.substring(0, 100)}`);
            }
            const postData = await postResponse.json();
            console.log('POST response:', postData);
            
            console.log('✅ All tests passed!');
            alert('Server tests completed successfully! Check console for details.');
            
        } catch (error) {
            console.error('❌ Test failed:', error);
            alert('Test failed: ' + error.message);
        }
    };
    
    // Clear console function
    window.clearLogs = function() {
        console.clear();
        console.log('Console cleared! 🧹');
    };
    
    // Display server info on load
    console.log(`
╔══════════════════════════════════════════╗
║     Scalable Web Server Demo            ║
║     Connected to localhost:3000         ║
╚══════════════════════════════════════════╝
Try these commands:
• testServer() - Run server tests
• clearLogs()  - Clear console
    `);
});