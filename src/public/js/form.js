// Form validation and preview functionality

document.addEventListener('DOMContentLoaded', function() {
    const imageUrlInput = document.getElementById('image_url');
    const form = document.querySelector('form');

    // Real-time image preview
    if (imageUrlInput) {
        imageUrlInput.addEventListener('blur', function() {
            const url = this.value.trim();
            if (url) {
                previewImage(url);
            }
        });
    }

    // Form validation
    if (form) {
        form.addEventListener('submit', function(e) {
            const itemId = document.getElementById('item_id').value;
            
            // Validate item_id format (alphanumeric and underscore only)
            const itemIdPattern = /^[a-zA-Z0-9_]+$/;
            if (!itemIdPattern.test(itemId)) {
                e.preventDefault();
                alert('アイテムIDは英数字とアンダースコアのみ使用できます。');
                return false;
            }
        });
    }
});

function previewImage(url) {
    let previewContainer = document.querySelector('.preview');
    
    if (!previewContainer) {
        previewContainer = document.createElement('div');
        previewContainer.className = 'preview';
        document.querySelector('.container').appendChild(previewContainer);
    }
    
    previewContainer.innerHTML = `
        <h3>プレビュー</h3>
        <img src="${url}" alt="Preview" style="max-width: 300px; border-radius: 8px;" 
             onerror="this.src='https://i.imgur.com/uv8oiH9.png'; this.alt='画像を読み込めませんでした'">
    `;
}

// Confirm delete action
function confirmDelete(itemTitle) {
    return confirm(`本当に「${itemTitle}」を削除しますか？この操作は取り消せません。`);
}
