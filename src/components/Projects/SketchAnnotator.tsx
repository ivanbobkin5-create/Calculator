import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Text, Rect, Circle, Arrow } from 'react-konva';
import useImage from 'use-image';
import { Pencil, Square, Circle as CircleIcon, ArrowRight, Type, Save, Undo, MousePointer2, Move } from 'lucide-react';

export const SketchAnnotator = ({ imageUrl, onSave }: { imageUrl: string, onSave: (annotatedImageUrl: string) => void }) => {
  const [image] = useImage(imageUrl);
  const stageRef = useRef<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'cursor' | 'pencil' | 'rect' | 'hinge' | 'arrow' | 'note' | 'size'>('pencil');
  const [color, setColor] = useState('#df4b26');
  const [editingText, setEditingText] = useState<{ id: number, text: string } | null>(null);

  const undo = () => setLines(lines.slice(0, -1));

  const handleMouseDown = (e: any) => {
    // Не рисуем, если кликнули на существующий элемент или включен курсор (режим выбора/перетаскивания)
    if (tool === 'cursor') return;
    
    // Если кликнули на элемент (клик для перетаскивания), то пропускаем создание фона, если только не кликнули пустое место
    if (e.target !== e.target.getStage() && e.target.name() !== 'background' && e.target.name() !== 'imageBg') return;

    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    const id = Date.now();
    if (tool === 'pencil') {
      setLines([...lines, { id, points: [pos.x, pos.y], tool: 'pencil', color, x: 0, y: 0 }]);
    } else if (tool === 'rect') {
      setLines([...lines, { id, x: pos.x, y: pos.y, width: 0, height: 0, tool: 'rect', color }]);
    } else if (tool === 'hinge') {
      setLines([...lines, { id, x: pos.x, y: pos.y, tool: 'hinge', color }]);
    } else if (tool === 'arrow') {
      setLines([...lines, { id, points: [pos.x, pos.y, pos.x, pos.y], tool: 'arrow', color, x: 0, y: 0 }]);
    } else if (tool === 'note') {
      setLines([...lines, { id, x: pos.x, y: pos.y, text: 'Текст', tool: 'note', color }]);
    } else if (tool === 'size') {
      // Инициализируем x и y, чтобы размер не прыгал в левый верхний угол (0,0)
      setLines([...lines, { id, x: pos.x, y: pos.y, points: [pos.x, pos.y, pos.x, pos.y], text: 'Размер', tool: 'size', color }]);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || tool === 'cursor') return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let last = lines[lines.length - 1];
    
    if (last.tool === 'pencil') {
      last.points = last.points.concat([point.x, point.y]);
    } else if (last.tool === 'rect') {
      last.width = point.x - last.x;
      last.height = point.y - last.y;
    } else if (last.tool === 'arrow') {
      last.points = [last.points[0], last.points[1], point.x, point.y];
    } else if (last.tool === 'size') {
      last.points = [last.points[0], last.points[1], point.x, point.y];
      // Ставим текст примерно по центру вектора размера
      last.x = (last.points[0] + point.x) / 2;
      last.y = (last.points[1] + point.y) / 2 - 20; 
    }
    
    lines.splice(lines.length - 1, 1, last);
    setLines([...lines]);
  };

  const handleMouseUp = () => setIsDrawing(false);

  const handleTextDblClick = (id: number, text: string) => {
    setEditingText({ id, text });
  };

  const handleTextChange = (newText: string) => {
    if (editingText) {
      setLines(lines.map(l => l.id === editingText.id ? { ...l, text: newText } : l));
      setEditingText(null);
    }
  };

  const handleDragEnd = (i: number, e: any) => {
    const newLines = [...lines];
    newLines[i].x = e.target.x();
    newLines[i].y = e.target.y();
    setLines(newLines);
  };

  const buttonClass = (active: boolean) => `flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`;

  // Расчет пропорций картинки
  let imgWidth = 800;
  let imgHeight = 600;
  let imgX = 0;
  let imgY = 0;
  if (image) {
    const scale = Math.min(800 / image.width, 600 / image.height);
    imgWidth = image.width * scale;
    imgHeight = image.height * scale;
    imgX = (800 - imgWidth) / 2;
    imgY = (600 - imgHeight) / 2;
  }

  const isDraggable = true;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center bg-gray-50 p-2 rounded-xl border border-gray-100">
        <button onClick={() => setTool('cursor')} className={buttonClass(tool === 'cursor')} title="Выделение и перемещение"><MousePointer2 className="w-4 h-4 mr-1" /> Курсор</button>
        <div className="w-px h-6 bg-gray-200 mx-1"></div>
        <button onClick={() => setTool('pencil')} className={buttonClass(tool === 'pencil')}><Pencil className="w-4 h-4 mr-1" /> Карандаш</button>
        <button onClick={() => setTool('rect')} className={buttonClass(tool === 'rect')}><Square className="w-4 h-4 mr-1" /> Рамка</button>
        <button onClick={() => setTool('hinge')} className={buttonClass(tool === 'hinge')}><CircleIcon className="w-4 h-4 mr-1" /> Петля</button>
        <button onClick={() => setTool('arrow')} className={buttonClass(tool === 'arrow')}><ArrowRight className="w-4 h-4 mr-1" /> Стрелка</button>
        <button onClick={() => setTool('note')} className={buttonClass(tool === 'note')}><Type className="w-4 h-4 mr-1" /> Текст</button>
        <button onClick={() => setTool('size')} className={buttonClass(tool === 'size')}><Move className="w-4 h-4 mr-1" /> Размер</button>
        <div className="w-px h-6 bg-gray-200 mx-1"></div>
        <button onClick={undo} className="flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm"><Undo className="w-4 h-4 mr-1" /> Назад</button>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 shadow-sm" title="Цвет" />
        <button onClick={() => onSave(stageRef.current.toDataURL({ pixelRatio: 2 }))} className="ml-auto flex items-center px-5 py-2 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"><Save className="w-4 h-4 mr-2" /> Сохранить эскиз</button>
      </div>
      
      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-gray-100 shadow-inner flex justify-center w-full overflow-x-auto relative min-h-[600px]">
        <Stage 
          width={800} 
          height={600} 
          onMouseDown={handleMouseDown} 
          onMousemove={handleMouseMove} 
          onMouseup={handleMouseUp} 
          ref={stageRef}
          className={`bg-white shadow-md mx-auto ${tool === 'cursor' ? 'cursor-move' : 'cursor-crosshair'}`}
        >
          <Layer>
            {/* Белый фон, чтобы можно было кликать и рисовать везде, даже если картинка маленькая */}
            <Rect 
              x={0} 
              y={0} 
              width={800} 
              height={600} 
              fill="#ffffff" 
              name="background"
            />
            {image && (
              <KonvaImage 
                image={image} 
                x={imgX} 
                y={imgY} 
                width={imgWidth} 
                height={imgHeight} 
                name="imageBg"
              />
            )}
            
            {lines.map((line, i) => {
              if (line.tool === 'pencil') return (
                <Line key={i} x={line.x || 0} y={line.y || 0} points={line.points} stroke={line.color} strokeWidth={5} tension={0.5} lineCap="round" lineJoin="round" draggable={isDraggable} onDragEnd={(e) => handleDragEnd(i, e)} />
              );
              if (line.tool === 'rect') return (
                <Rect key={i} x={line.x} y={line.y} width={line.width} height={line.height} stroke={line.color} strokeWidth={3} draggable={isDraggable} onDragEnd={(e) => handleDragEnd(i, e)} />
              );
              if (line.tool === 'hinge') return (
                <Circle key={i} x={line.x} y={line.y} radius={8} stroke={line.color} strokeWidth={3} fill="#ffffff" draggable={isDraggable} onDragEnd={(e) => handleDragEnd(i, e)} />
              );
              if (line.tool === 'arrow') return (
                <Arrow key={i} x={line.x || 0} y={line.y || 0} points={line.points} stroke={line.color} strokeWidth={3} fill={line.color} draggable={isDraggable} onDragEnd={(e) => handleDragEnd(i, e)} />
              );
              if (line.tool === 'note') return (
                <Text key={i} x={line.x} y={line.y} text={line.text} fontSize={18} fontStyle="bold" padding={5} fill={line.color} draggable={isDraggable} onDragEnd={(e) => handleDragEnd(i, e)} onDblClick={() => handleTextDblClick(line.id, line.text)} onTap={() => handleTextDblClick(line.id, line.text)} />
              );
              if (line.tool === 'size') return (
                <React.Fragment key={i}>
                  <Arrow x={line.x_arr || 0} y={line.y_arr || 0} points={line.points} stroke={line.color} strokeWidth={2} fill={line.color} pointerAtBeginning draggable={isDraggable} onDragEnd={(e) => {
                      const newLines = [...lines];
                      newLines[i].x_arr = e.target.x();
                      newLines[i].y_arr = e.target.y();
                      setLines(newLines);
                  }} />
                  <Text x={line.x} y={line.y} text={line.text} fontSize={18} fontStyle="bold" padding={4} fill={line.color} draggable={isDraggable} onDragEnd={(e) => handleDragEnd(i, e)} onDblClick={() => handleTextDblClick(line.id, line.text)} onTap={() => handleTextDblClick(line.id, line.text)} />
                </React.Fragment>
              );
              return null;
            })}
          </Layer>
        </Stage>
        {editingText && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-10 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center w-full max-w-[400px]">
              <label className="text-sm font-bold text-gray-700 mb-2">Изменить текст</label>
              <textarea
                value={editingText.text}
                onChange={(e) => setEditingText({ ...editingText, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleTextChange(editingText.text);
                  }
                }}
                className="w-full h-32 p-3 border border-gray-200 rounded-xl text-left font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none mb-2 resize-y"
                autoFocus
              />
              <div className="text-[10px] text-gray-400 font-medium mb-4 w-full text-center">
                Enter — сохранить &nbsp;|&nbsp; Shift+Enter — перенос строки
              </div>
              <button 
                onClick={() => handleTextChange(editingText.text)}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
              >
                Сохранить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
