export async function apiFetch(endpoint, options = {}) {
  const accessToken = localStorage.getItem('accessToken');
  const headers = {
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';
  let response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && localStorage.getItem('refreshToken')) {
    try {
      const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: localStorage.getItem('userId'),
          refreshToken: localStorage.getItem('refreshToken'),
        }),
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        headers['Authorization'] = `Bearer ${data.accessToken}`;
        response = await fetch(`${baseUrl}${endpoint}`, {
          ...options,
          headers,
        });
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Refresh token error:', err);
      localStorage.clear();
      window.location.href = '/login';
    }
  }

  return response;
}
