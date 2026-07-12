/*
Mini Text Editor
Created by: Hariyanto Lim

Purpose:
1. To write a blog or a news or a post content using simple text editor.
2. The output will be safe to be stored into MySQL database.
3. When loaded from MySQL database, the output will display as the same as the input.
4. Small JS only for writing/editing, on display there is no need to use this JS.

Why re-inventing the well ? there are so many editor already ?
- Because I want to make it simpler and less dependency.
*/

function initMiniTextEditor(container) {
  if (!container || container.nodeType !== 1) return null;

  var initialContent = container.innerHTML;

  container.innerHTML =
    '<div class="mte-toolbar">' +
      '<button data-cmd="bold" title="Bold (Ctrl+B)"><b>B</b></button>' +
      '<button data-cmd="italic" title="Italic (Ctrl+I)"><i>I</i></button>' +
      '<button data-cmd="underline" title="Underline (Ctrl+U)"><u>U</u></button>' +
      '<button data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>' +
      '<span class="mte-link-ind" title="Link">LINK</span>' +
      '<span class="mte-sep"></span>' +
      '<button data-cmd="insertOrderedList" title="Ordered List"><span style="text-decoration:none">1.</span></button>' +
      '<button data-cmd="insertUnorderedList" title="Bullet List"><span style="text-decoration:none">&bull;</span></button>' +
      '<span class="mte-sep"></span>' +
      //'<button data-cmd="code" title="Code Block">&lt;/&gt;</button>' +
    '</div>' +
    '<div class="mte-editor" contenteditable="true">' + initialContent + '</div>';

  var editor = container.querySelector('.mte-editor');
  var toolbarBtns = container.querySelectorAll('[data-cmd]');
  var linkInd = container.querySelector('.mte-link-ind');

  var autoLinkTimer = null;

  toolbarBtns.forEach(function(btn) {
    var cmd = btn.dataset.cmd;
    btn.addEventListener('click', function() {
      editor.focus();
      if (cmd === 'code') {
        insertCodeBlock();
      } else {
        document.execCommand(cmd, false, null);
      }
      updateActiveState();
    });
  });

  function insertCodeBlock() {
    var sel = window.getSelection();
    if (!sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    var selectedText = range.toString();
    if (!selectedText) return;

    var pre = document.createElement('pre');
    pre.textContent = selectedText;

    range.deleteContents();
    range.insertNode(pre);

    range.selectNodeContents(pre);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function cursorInLink() {
    var sel = window.getSelection();
    if (!sel.rangeCount) return false;
    var node = sel.anchorNode;
    while (node && node !== editor) {
      if (node.nodeName === 'A') return true;
      node = node.parentNode;
    }
    return false;
  }

  function updateActiveState() {
    var inLink = cursorInLink();

    toolbarBtns.forEach(function(btn) {
      var cmd = btn.dataset.cmd;
      if (cmd === 'underline' && inLink) {
        btn.classList.remove('active');
        return;
      }
      try {
        btn.classList.toggle('active', document.queryCommandState(cmd));
      } catch(e) {}
    });

    if (linkInd) linkInd.classList.toggle('active', inLink);
  }

  var URL_RE = /\b(https?:\/\/\S+)/gi;

  editor.addEventListener('input', function() {
    clearTimeout(autoLinkTimer);
    autoLinkTimer = setTimeout(autoLink, 600);
  });

  function editorTextOffset(container, targetNode, targetOffset) {
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    var offset = 0;
    var node;
    while ((node = walker.nextNode())) {
      if (node === targetNode) return offset + targetOffset;
      offset += node.textContent.length;
    }
    return offset;
  }

  function restoreSelection(startOff, endOff) {
    var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
    var textNodes = [];
    var node;
    while ((node = walker.nextNode())) textNodes.push(node);

    function findPos(off) {
      var count = 0;
      for (var i = 0; i < textNodes.length; i++) {
        var len = textNodes[i].textContent.length;
        if (count + len >= off)
          return {node: textNodes[i], pos: Math.min(off - count, len)};
        count += len;
      }
      if (textNodes.length)
        return {node: textNodes[textNodes.length - 1], pos: textNodes[textNodes.length - 1].textContent.length};
      return null;
    }

    var start = findPos(startOff);
    if (!start) return;
    var range = document.createRange();
    range.setStart(start.node, start.pos);
    if (endOff !== undefined && endOff !== startOff) {
      var end = findPos(endOff);
      if (end) range.setEnd(end.node, end.pos);
      else range.collapse(true);
    } else {
      range.collapse(true);
    }
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function autoLink() {
    /* save selection — only when anchor is inside a text node */
    var savedStart = -1, savedEnd = -1;
    var sel = window.getSelection();
    if (sel.rangeCount) {
      var r = sel.getRangeAt(0);
      if (r.startContainer.nodeType === 3) {
        savedStart = editorTextOffset(editor, r.startContainer, r.startOffset);
        if (!r.collapsed && r.endContainer.nodeType === 3)
          savedEnd = editorTextOffset(editor, r.endContainer, r.endOffset);
      }
    }

    editor.normalize();
    var anchors = editor.querySelectorAll('a');
    for (var i = anchors.length - 1; i >= 0; i--) {
      var a = anchors[i];
      var parent = a.parentNode;
      while (a.firstChild) parent.insertBefore(a.firstChild, a);
      parent.removeChild(a);
    }
    editor.normalize();

    var walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node.textContent) continue;
      URL_RE.lastIndex = 0;
      if (!URL_RE.test(node.textContent)) continue;

      URL_RE.lastIndex = 0;
      var docFrag = document.createDocumentFragment();
      var lastIdx = 0;
      var match;
      while ((match = URL_RE.exec(node.textContent)) !== null) {
        var url = match[0];
        if (url.indexOf('.') < 0) continue;
        url = url.replace(/[,.!?;:)]+$/, '');

        if (match.index > lastIdx)
          docFrag.appendChild(document.createTextNode(node.textContent.slice(lastIdx, match.index)));

        var a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.textContent = url;
        docFrag.appendChild(a);
        lastIdx = match.index + url.length;
      }
      if (lastIdx < node.textContent.length)
        docFrag.appendChild(document.createTextNode(node.textContent.slice(lastIdx)));

      node.parentNode.replaceChild(docFrag, node);
    }

    /* restore selection */
    if (savedStart >= 0) restoreSelection(savedStart, savedEnd >= 0 ? savedEnd : savedStart);

    updateActiveState();
  }

  editor.addEventListener('keyup', updateActiveState);
  editor.addEventListener('mouseup', updateActiveState);

  updateActiveState();

  return editor;
}
