import React, { useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Text, Rect, Circle, Arrow } from 'react-konva';
import useImage from 'use-image';
import { Pencil, Square, Circle as CircleIcon, ArrowRight, Type, Save, Undo } from 'lucide-react';

export const SketchAnnotator = ({ imageUrl, onSave }: { imageUrl: string, onSave: (annotatedImageUrl: string) => void }) => {
  const [image] = useImage(imageUrl);
  const stageRef = useRef<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pencil' | 'rect' | 'hinge' | 'arrow' | 'note' | 'size'>('pencil');
  const [color, setColor] = useState('#df4b26');
  const [editingText, setEditingText] = useState<{ id: number, text: string } | null>(null);

  const undo = () => setLines(lines.slice(0, -1));

  const handleMouseDown = (e: any) => {
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    const id = Date.now();
    if (tool === 'pencil') {
      setLines([...lines, { id, points: [pos.x, pos.y], tool: 'pencil', color }]);
    } else if (tool === 'rect') {
      setLines([...lines, { id, x: pos.x, y: pos.y, width: 0, height: 0, tool: 'rect', color }]);
    } else if (tool === 'hinge') {
      setLines([...lines, { id, x: pos.x, y: pos.y, tool: 'hinge', color }]);
    } else if (tool === 'arrow') {
      setLines([...lines, { id, points: [pos.x, pos.y, pos.x, pos.y], tool: 'arrow', color }]);
    } else if (tool === 'note') {
      setLines([...lines, { id, x: pos.x, y: pos.y, text: 'Текст', tool: 'note', color }]);
    } else if (tool === 'size') {
      setLines([...lines, { id, points: [pos.x, pos.y, pos.x, pos.y], text: '0 мм', tool: 'size', color }]);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let last = lines[lines.length - 1];
    if (last.tool === 'pencil') {
      last.points = last.points.concat([point.x, point.y]);
    } else if (last.tool === 'rect') {
      last.width = point.x - last.x;
      last.height = point.y - last.y;
    } else if (last.tool === 'arrow' || last.tool === 'size') {
      last.points = [last.points[0], last.points[1], point.x, point.y];
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

  const buttonClass = (active: boolean) => `flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => setTool('pencil')} className={buttonClass(tool === 'pencil')}><Pencil className="w-4 h-4 mr-1" /> Карандаш</button>
        <button onClick={() => setTool('rect')} className={buttonClass(tool === 'rect')}><Square className="w-4 h-4 mr-1" /> Рамка</button>
        <button onClick={() => setTool('hinge')} className={buttonClass(tool === 'hinge')}><CircleIcon className="w-4 h-4 mr-1" /> Петля</button>
        <button onClick={() => setTool('arrow')} className={buttonClass(tool === 'arrow')}><ArrowRight className="w-4 h-4 mr-1" /> Стрелка</button>
        <button onClick={() => setTool('note')} className={buttonClass(tool === 'note')}><Type className="w-4 h-4 mr-1" /> Комментарий</button>
        <button onClick={() => setTool('size')} className={buttonClass(tool === 'size')}><Type className="w-4 h-4 mr-1" /> Размер</button>
        <button onClick={undo} className="flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-700 hover:bg-gray-300"><Undo className="w-4 h-4" /></button>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" title="Цвет" />
        <button onClick={() => onSave(stageRef.current.toDataURL())} className="ml-auto flex items-center px-4 py-2 rounded-lg font-bold bg-blue-600 text-white hover:bg-blue-700"><Save className="w-4 h-4 mr-2" /> Сохранить</button>
      </div>
      <div className="border rounded-lg overflow-hidden bg-white">
        <Stage width={800} height={600} onMouseDown={handleMouseDown} onMousemove={handleMouseMove} onMouseup={handleMouseUp} ref={stageRef}>
          <Layer>
            {image && <KonvaImage image={image} width={800} height={600} />}
            {lines.map((line, i) => {
              if (line.tool === 'pencil') return <Line key={i} points={line.points} stroke={line.color} strokeWidth={5} tension={0.5} lineCap="round" lineJoin="round" />;
              if (line.tool === 'rect') return <Rect key={i} x={line.x} y={line.y} width={line.width} height={line.height} stroke={line.color} strokeWidth={3} />;
              if (line.tool === 'hinge') return <Circle key={i} x={line.x} y={line.y} radius={7} stroke={line.color} strokeWidth={2} />;
              if (line.tool === 'arrow') return <Arrow key={i} points={line.points} stroke={line.color} strokeWidth={3} fill={line.color} />;
              if (line.tool === 'note' || line.tool === 'size') return (
                <Text key={i} x={line.x} y={line.y} text={line.text} fontSize={16} padding={5} fill={line.color} onDblClick={() => handleTextDblClick(line.id, line.text)} />
              );
              return null;
            })}
          </Layer>
        </Stage>
        {editingText && (
          <input
            type="text"
            value={editingText.text}
            onChange={(e) => setEditingText({ ...editingText, text: e.target.value })}
            onBlur={() => handleTextChange(editingText.text)}
            onKeyDown={(e) => e.key === 'Enter' && handleTextChange(editingText.text)}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-2 border rounded"
            autoFocus
          />
        )}
      </div>
    </div>
  );
};
