/* eslint-disable prettier/prettier */
import { Controller, Post, Body, Res, Get, Req, Render } from '@nestjs/common';
import { AppService } from './app.service';
import { QueryDto } from './dto/query.dto';
import { Request, Response } from 'express';
import { HttpService } from '@nestjs/axios';
import * as fs from 'fs';
import * as path from 'path';
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly httpService: HttpService,
  ) {
    if (!fs.existsSync(this.chatDirectory)) {
      fs.mkdirSync(this.chatDirectory, { recursive: true });
    }
  }
  private chatDirectory = path.join(__dirname, '..', 'chats');

  @Get('login')
  @Render('login')
  loginRender() {
    return { login: true, layout: 'layouts/main' };
  }

  @Get('')
  @Render('index')
  indexRender() {
    return { index: true, layout: 'layouts/main' };
  }

  @Post('promt')
  async submitQuery(
    @Req() req,
    @Res() res: Response,
    @Body() queryDto: QueryDto,
  ) {
    try {
      // Get response from Gemma API
      const responsePromt = await this.httpService
        .post('http://localhost:11434/api/chat', {
          model: 'llama3.2',
          messages: [
            { role: 'user', content: queryDto.promt },
            
          ],
        })
        .toPromise();

      // Extract full answer from response
      const fullAnswar = [
        ...responsePromt.data.matchAll(/"content":\s?"([^"]+)"/g),
      ];
      const FinalAnswarcombinedContent = fullAnswar
        .map((match) => match[1])
        .join('');

      let chatId: string;
      let existingChatData: any;

      // Check if chatId exists in the request
      if (queryDto.chatId) {
        chatId = queryDto.chatId;
        const existingFilePath = path.join(
          this.chatDirectory,
          `${chatId}.json`,
        );

        // Check if file exists
        if (fs.existsSync(existingFilePath)) {
          // Read existing chat data
          existingChatData = JSON.parse(
            fs.readFileSync(existingFilePath, 'utf8'),
          );

          // Append new messages
          existingChatData.messages.push(
            { role: 'user', content: queryDto.promt },
            { role: 'assistant', content: FinalAnswarcombinedContent },
          );

          // Update timestamp
          existingChatData.timestamp = new Date().toISOString();

          // Write updated data back to file
          fs.writeFileSync(
            existingFilePath,
            JSON.stringify(existingChatData, null, 2),
          );
        } else {
          throw new Error('Chat file not found');
        }
      } else {
        // Generate new chatId if none provided
        chatId = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
        const newFilePath = path.join(this.chatDirectory, `${chatId}.json`);

        // Create new chat data
        const newChatData = {
          id: chatId,
          timestamp: new Date().toISOString(),
          messages: [
            { role: 'user', content: queryDto.promt },
            { role: 'assistant', content: FinalAnswarcombinedContent },
          ],
        };

        // Write new file
        fs.writeFileSync(newFilePath, JSON.stringify(newChatData, null, 2));
      }

      return res.redirect(`/result?chatId=${chatId}`);
    } catch (error) {
      console.error('Error in submitQuery:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  @Get('result')
  async result(@Req() req, @Res() res: Response) {
    const chatId = req.query.chatId as string;

    const filePath = path.join(__dirname, '..', 'chats', `${chatId}.json`);
    const fileData = fs.readFileSync(filePath, 'utf-8');
    const messages = JSON.parse(fileData);

    const messageList = messages?.messages;
    const processedMessages = await messageList.map((message) => {
      const isPersian =
        /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
          message.content,
        );
      return {
        ...message,
        isUser: message.role === 'user', // True if 'user', false otherwise
        content: message.content.replace(/\\n/g, '\n').replace(/\n/g, '<br>'),
        direction: isPersian ? 'right' : 'ltr',
      };
    });

    console.log(processedMessages, 'x');
    return res.render('result', {
      chatId,
      messages: processedMessages,
      layout: 'layouts/main',
    });
  }
}
